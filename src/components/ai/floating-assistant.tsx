"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getPrimaryRole } from "@/lib/types";
import * as AIService from '@/services/ai.service';
import type { ChatInput } from '@/ai/flows/chatbot-flow';
import { useMatchesStore } from "@/store/useMatchesStore";
import { usePlayersStore } from "@/store/usePlayersStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { AsyncFeedback } from "@/components/ui/async-feedback";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ciao coach! Sono il tuo assistente PitchMan. Come posso aiutarti con le statistiche della squadra oggi?" }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dati dal client Firebase SDK (già autenticato)
  const matches = useMatchesStore(state => state.matches);
  const players = usePlayersStore(state => state.players);
  const activeSeason = useSeasonsStore(state => state.activeSeason);

  const { run: runChat, loading: isLoading, error } = useAsyncAction(
    (input: ChatInput) => AIService.chatbot(input),
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    const teamContext = {
      seasonName: activeSeason?.name,
      matches: matches.map(m => ({
        opponent: m.opponent,
        date: m.date,
        isHome: m.isHome,
        status: m.status,
        result: m.result ? { home: m.result.home, away: m.result.away } : undefined,
      })),
      players: players.map(p => ({
        name: p.name,
        role: getPrimaryRole(p),
        stats: p.stats ? {
          appearances: p.stats.appearances || 0,
          goals: p.stats.goals || 0,
          assists: p.stats.assists || 0,
          avgMinutes: p.stats.avgMinutes || 0,
          yellowCards: p.stats.yellowCards || 0,
          redCards: p.stats.redCards || 0,
        } : undefined,
      })),
    };

    const response = await runChat({ message: userMessage, teamContext });
    if (!response) {
      // Uniform error message instead of a raw console.error
      setMessages(prev => [...prev, { role: "assistant", content: "Scusa coach, ho avuto un problema tecnico nell'analizzare i dati. Riprova tra un momento." }]);
      return;
    }
    setMessages(prev => [...prev, { role: "assistant", content: response.text }]);
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[340px] sm:w-[380px] h-[520px] bg-white/95 dark:bg-black/90 backdrop-blur-xl border border-divider dark:border-brand-green/30 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="p-5 border-b border-divider dark:border-brand-green/20 flex items-center justify-between bg-card dark:bg-black transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black dark:bg-white flex items-center justify-center shadow-lg border border-border dark:border-white/10">
                  <Bot className="text-white dark:text-black h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-foreground dark:text-white leading-none">Coach AI</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-wider">Analista Tattico</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="rounded-full hover:bg-black/5 dark:hover:bg-white/5 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Chat Content */}
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                        msg.role === 'user' ? "bg-muted dark:bg-zinc-800" : "bg-primary/10 dark:bg-brand-green/10"
                    )}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-primary dark:text-brand-green" />}
                    </div>
                    <div className={cn(
                      "p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-sm",
                      msg.role === 'user' 
                        ? "bg-primary text-white dark:bg-brand-green dark:text-black rounded-tr-none" 
                        : "bg-muted dark:bg-zinc-900 text-foreground dark:text-zinc-200 rounded-tl-none border border-divider dark:border-white/5"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 mr-auto h-8 items-center pl-1">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-muted-foreground/40" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40 animate-pulse">Analisi dati in corso...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-5 border-t border-divider dark:border-brand-green/20">
              <AsyncFeedback
                loading={false}
                error={error}
                className="mb-2"
              />
              <div className="relative group">
                <Input 
                  placeholder="Chiedimi della rosa o dei gol..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="h-12 bg-muted/50 dark:bg-zinc-900 border-none rounded-2xl pr-12 focus-visible:ring-1 focus-visible:ring-primary/30 dark:focus-visible:ring-brand-green/30 placeholder:text-muted-foreground dark:text-muted-foreground/40 text-xs font-medium"
                />
                <Button 
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 dark:shadow-brand-green/20 border-none"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "h-12 w-12 rounded-[18px] flex items-center justify-center transition-all shadow-2xl relative pointer-events-auto",
          isOpen 
            ? "bg-white dark:bg-zinc-900 text-foreground dark:text-white border border-divider dark:border-brand-green/20" 
            : "bg-primary dark:bg-brand-green text-white dark:text-black"
        )}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="relative">
              <div className="absolute -inset-4 bg-white/20 dark:bg-black/20 rounded-full blur-xl animate-pulse" />
              <Bot className="h-6 w-6 relative" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-primary dark:border-brand-green rounded-full shadow-sm" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
