import React, { useState, useRef, useEffect } from 'react'
import { X, Trash2, Edit3, Copy, Share } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  isOpen: boolean
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onCopyId: () => void
  position: { x: number; y: number }
  sessionTitle: string
}

export function ContextMenu({
  isOpen,
  onClose,
  onRename,
  onDelete,
  onCopyId,
  position,
  sessionTitle
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Ensure menu stays within viewport
  const menuStyle: React.CSSProperties = {
    left: Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 250 : position.x), // Keep within right edge
    top: Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 300 : position.y), // Keep within bottom edge
    maxHeight: '80vh',
    overflowY: 'auto'
  }

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 bg-[#2c2c2c] border border-gray-600 rounded-lg shadow-xl py-1 min-w-[200px] max-w-[250px]"
      style={menuStyle}
    >
      {/* Header with session title */}
      <div className="px-3 py-2 border-b border-gray-600">
        <div className="text-white text-sm font-medium truncate">
          {sessionTitle}
        </div>
      </div>

      {/* Menu Options */}
      <div className="py-1">
        <button
          onClick={() => {
            onCopyId()
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-left text-sm"
        >
          <Share className="h-4 w-4" />
          <span>Share</span>
        </button>

        <button
          onClick={() => {
            onRename()
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-left text-sm"
        >
          <Edit3 className="h-4 w-4" />
          <span>Rename</span>
        </button>

        <button
          onClick={() => {
            onCopyId()
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-left text-sm"
        >
          <Copy className="h-4 w-4" />
          <span>Copy conversation ID</span>
        </button>

        <div className="border-t border-gray-600 my-1"></div>

        <button
          onClick={() => {
            onDelete()
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left text-sm"
        >
          <Trash2 className="h-4 w-4" />
          <span>Archive</span>
        </button>
      </div>
    </div>
  )
}

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  sessionTitle: string
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  sessionTitle
}: DeleteConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-[#2c2c2c] border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-medium">Delete chat?</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-6">
          This will delete "<span className="text-white font-medium">{sessionTitle}</span>". 
          This action cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

interface RenameModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newTitle: string) => void
  currentTitle: string
}

export function RenameModal({
  isOpen,
  onClose,
  onConfirm,
  currentTitle
}: RenameModalProps) {
  const [title, setTitle] = useState(currentTitle)
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen, currentTitle])

  useEffect(() => {
    if (!isOpen) return

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && title.trim() !== currentTitle) {
      onConfirm(title.trim())
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-[#2c2c2c] border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-medium">Rename conversation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-3 py-2 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter conversation title..."
            maxLength={100}
          />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || title.trim() === currentTitle}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
