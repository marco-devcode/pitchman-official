"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Trophy, Zap } from "lucide-react"

import { FAQ_DATA, type FAQItem } from "@/lib/faq-data"


// Raggruppa le FAQ per categoria
function groupByCategory(items: FAQItem[]): Record<string, FAQItem[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FAQItem[]>);
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Primo Avvio": "🚀",
  "Partite": "⚽",
  "Rosa & Giocatori": "👥",
  "Statistiche": "📊",
  "AI Assistant": "🤖",
  "Collaborazione": "🔗",
  "Piano Pro": "💎",
  "Privacy & Sicurezza": "🔒",
};

export function GuideDialog() {
  const grouped = groupByCategory(FAQ_DATA);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white dark:bg-black font-black text-xs text-foreground dark:text-white shadow-sm transition-all hover:bg-muted dark:hover:bg-brand-green/10 dark:border-brand-green/30 dark:shadow-theme group shrink-0"
          title="FAQ & Guida"
        >
          <span className="group-hover:scale-110 transition-transform">?</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden border-border dark:border-brand-green/30 dark:shadow-theme">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black italic uppercase tracking-tighter">
            <Trophy className="h-6 w-6 text-brand-green" />
            FAQ <span className="text-brand-green">PitchMan</span>
          </DialogTitle>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Domande frequenti e guida all&apos;utilizzo
          </p>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(85vh-100px)] px-6 py-4">
          <div className="space-y-6 pb-8">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-base">{CATEGORY_EMOJI[category] || "📌"}</span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {category}
                  </h3>
                </div>

                <Accordion type="single" collapsible className="space-y-1">
                  {items.map((faq, idx) => (
                    <AccordionItem
                      key={`${category}-${idx}`}
                      value={`${category}-${idx}`}
                      className="border border-border dark:border-brand-green/10 rounded-xl px-4 overflow-hidden data-[state=open]:border-brand-green/30 transition-colors"
                    >
                      <AccordionTrigger className="text-sm font-semibold text-left py-3 hover:no-underline hover:text-brand-green transition-colors [&[data-state=open]]:text-brand-green">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 whitespace-pre-line">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}

            {/* Pro Tip */}
            <div className="flex gap-4 p-5 rounded-2xl bg-brand-green/5 border border-brand-green/20 items-start">
              <div className="p-2 rounded-lg bg-brand-green/10 shrink-0">
                <Zap className="h-5 w-5 text-brand-green fill-brand-green" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-tighter text-brand-green">Pro Tip</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Puoi anche chiedere all&apos;
                  <span className="font-bold text-foreground dark:text-white">AI Assistant</span> come usare
                  l&apos;app! Apri la chat dal bottone flottante in basso a destra e chiedi qualsiasi cosa.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
