import { Wallet } from "lucide-react";
import { AddExpenseForm } from "@/components/AddExpenseForm";
import { ExpenseDashboard } from "@/components/ExpenseDashboard";
import { StorageNotice } from "@/components/StorageNotice";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 shadow-[0_10px_30px_-18px_var(--color-primary)]">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary/80">
              Personal Finance
            </p>
            <h1 className="font-heading text-2xl leading-none sm:text-3xl">
              Expense Tracker
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track spending with a calmer, cleaner daily workflow.
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8">
        <StorageNotice />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-start">
          <div className="xl:sticky xl:top-24">
            <AddExpenseForm />
          </div>
          <ExpenseDashboard />
        </div>
      </section>
    </main>
  );
}
