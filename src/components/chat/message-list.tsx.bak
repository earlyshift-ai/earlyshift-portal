'use client'

import { Message } from '@ai-sdk/react'
import { useTenant } from '@/components/tenant-provider'
import { TenantLogo } from '@/components/tenant-logo'
import { User, Bot, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Start a conversation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const { tenant } = useTenant()
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: tenant?.primary_color || '#3B82F6' }}
          >
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {tenant?.logo_url ? (
              <TenantLogo size="sm" />
            ) : (
              <Bot className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : 'text-left'}`}>
        <div className="group relative">
          <div 
            className={`
              inline-block max-w-[80%] p-3 rounded-lg
              ${isUser 
                ? 'text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }
            `}
            style={isUser ? { backgroundColor: tenant?.primary_color || '#3B82F6' } : {}}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={tomorrow}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-md !bg-gray-900 !p-2"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code 
                          className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    },
                    pre({ children }) {
                      return <div>{children}</div>
                    },
                    p({ children }) {
                      return <p className="mb-2 last:mb-0">{children}</p>
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-2">{children}</ul>
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside mb-2">{children}</ol>
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote 
                          className="border-l-4 pl-4 italic"
                          style={{ borderColor: tenant?.primary_color || '#3B82F6' }}
                        >
                          {children}
                        </blockquote>
                      )
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Copy Button */}
          <Button
            size="sm"
            variant="ghost"
            className={`
              absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity
              ${isUser ? '-left-10' : '-right-10'}
            `}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.createdAt || Date.now()).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  )
}
