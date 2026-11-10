import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_FILE_BYTES, useEditorStore } from '../app/stores/editor'

const meta = { durationSec: 10, width: 640, height: 360, codec: 'avc1.64001f', fps: 30 }

function fakeFile(size: number): File {
  const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function fakeBitmap(): { bitmap: ImageBitmap, close: ReturnType<typeof vi.fn> } {
  const close = vi.fn()
  const bitmap: ImageBitmap = { width: 1, height: 1, close }
  return { bitmap, close }
}

describe('editor store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('rejects files over the limit before storing them', () => {
    const store = useEditorStore()
    store.loadFile(fakeFile(MAX_FILE_BYTES + 1))
    expect(store.phase).toBe('error')
    expect(store.file).toBeNull()
    expect(store.error).toBeTruthy()
  })

  it('accepts a file at the limit', () => {
    const store = useEditorStore()
    store.loadFile(fakeFile(MAX_FILE_BYTES))
    expect(store.phase).toBe('loading')
    expect(store.file).not.toBeNull()
  })

  it('setMeta selects the whole clip', () => {
    const store = useEditorStore()
    store.loadFile(fakeFile(10))
    store.setMeta(meta)
    expect([store.inSec, store.outSec, store.phase]).toEqual([0, 10, 'ready'])
  })

  it('setError switches to the error phase with the message', () => {
    const store = useEditorStore()
    store.loadFile(fakeFile(10))
    store.setError('boom')
    expect([store.phase, store.error]).toEqual(['error', 'boom'])
  })

  it('setTrim enforces the minimum length', () => {
    const store = useEditorStore()
    store.setMeta(meta)
    store.setTrim(5, 5)
    expect(store.outSec - store.inSec).toBeCloseTo(0.1)
  })

  it('reset closes bitmaps, revokes the export url and runs hooks', () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { revokeObjectURL: revoke })
    const store = useEditorStore()
    const a = fakeBitmap()
    const hook = vi.fn()
    store.onReset(hook)
    store.setThumb(0, a.bitmap)
    store.exportUrl = 'blob:x'
    store.reset()
    expect(a.close).toHaveBeenCalledOnce()
    expect(store.thumbs).toEqual([])
    expect(revoke).toHaveBeenCalledWith('blob:x')
    expect(hook).toHaveBeenCalledOnce()
    expect(store.phase).toBe('empty')
    vi.unstubAllGlobals()
  })

  it('reset works with nothing loaded', () => {
    const store = useEditorStore()
    expect(() => store.reset()).not.toThrow()
  })

  it('setThumb closes the bitmap it replaces', () => {
    const store = useEditorStore()
    const a = fakeBitmap()
    store.setThumb(0, a.bitmap)
    store.setThumb(0, fakeBitmap().bitmap)
    expect(a.close).toHaveBeenCalledOnce()
  })
})
