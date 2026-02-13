'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Point, Area } from 'react-easy-crop'

interface ImageCropperProps {
    imageSrc: string
    onCropComplete: (croppedBlob: Blob) => void
    onCancel: () => void
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

    const onCropChange = (crop: Point) => {
        setCrop(crop)
    }

    const onZoomChange = (zoom: number) => {
        setZoom(zoom)
    }

    const onCropCompleteHandler = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const createCroppedImage = async () => {
        try {
            if (!croppedAreaPixels) return
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (croppedBlob) {
                onCropComplete(croppedBlob)
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden w-full max-w-md flex flex-col h-[80vh] md:h-[600px]">
                <div className="relative flex-1 bg-black">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={onZoomChange}
                    />
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-slate-500">zoom_in</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full accent-primary h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={createCroppedImage}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            確認裁切
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImageCropper

// Helper function to create the cropped image
// Helper function to create the cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    // Iterative compression to get below 200KB
    let quality = 0.9
    let blob: Blob | null = null
    const MAX_SIZE_BYTES = 200 * 1024 // 200KB

    const getBlob = (q: number): Promise<Blob | null> => {
        return new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', q)
        })
    }

    // Try at least once
    blob = await getBlob(quality)

    while (blob && blob.size > MAX_SIZE_BYTES && quality > 0.3) {
        quality -= 0.1
        blob = await getBlob(quality)
        console.log(`Compressing... Quality: ${quality.toFixed(1)}, Size: ${(blob!.size / 1024).toFixed(2)}KB`)
    }

    return blob
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous')
        image.src = url
    })
}
