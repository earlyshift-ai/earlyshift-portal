'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Bot, Loader2, Zap } from 'lucide-react'
import { useTenant } from '@/components/tenant-provider'

interface Bot {
  id: string
  name: string
  description: string
  custom_name?: string
  model_config: {
    webhook_url?: string
    model?: string
    [key: string]: any
  }
}

interface BotSelectorProps {
  bots: Bot[]
  selectedBot: Bot | null
  onSelect: (bot: Bot) => void
  isLoading?: boolean
}

export function BotSelector({ bots, selectedBot, onSelect, isLoading }: BotSelectorProps) {
  const { tenant } = useTenant()
  const [isOpen, setIsOpen] = useState(false)

  const getBotIcon = (bot: Bot) => {
    const isWebhook = bot.model_config?.model === 'webhook'
    return isWebhook ? <Zap className="h-4 w-4" /> : <Bot className="h-4 w-4" />
  }

  const getBotTypeLabel = (bot: Bot) => {
    const isWebhook = bot.model_config?.model === 'webhook'
    return isWebhook ? 'AI Agent' : 'LLM Bot'
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading bots...
      </Button>
    )
  }

  if (bots.length === 0) {
    return (
      <Button variant="outline" disabled>
        <Bot className="h-4 w-4 mr-2" />
        No bots available
      </Button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            {selectedBot ? getBotIcon(selectedBot) : <Bot className="h-4 w-4" />}
            <span className="truncate">
              {selectedBot 
                ? (selectedBot.custom_name || selectedBot.name)
                : 'Select Bot'
              }
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {bots.map((bot) => (
          <DropdownMenuItem
            key={bot.id}
            onClick={() => {
              onSelect(bot)
              setIsOpen(false)
            }}
            className="flex flex-col items-start p-4 cursor-pointer"
          >
            <div className="flex items-center gap-2 w-full mb-1">
              {getBotIcon(bot)}
              <div className="flex items-center gap-2 flex-1">
                <span className="font-medium truncate">
                  {bot.custom_name || bot.name}
                </span>
                <span 
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: tenant?.primary_color || '#3B82F6' }}
                >
                  {getBotTypeLabel(bot)}
                </span>
              </div>
              {selectedBot?.id === bot.id && (
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tenant?.primary_color || '#3B82F6' }}
                />
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {bot.description}
            </p>
            {bot.model_config?.webhook_url && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <Zap className="h-3 w-3" />
                <span>Webhook-powered</span>
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
