"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  Filter,
  Inbox,
  Pencil,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { categoryColor, formatDate, formatINR, sumPaise } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { EditExpenseDialog } from "@/components/EditExpenseDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function SummarySection({ expenses }: { expenses: Expense[] }) {
  const total = sumPaise(expenses.map((e) => e.amount));

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Math.round(e.amount * 100);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-primary)_14%,white)_0%,var(--color-card)_55%,color-mix(in_oklab,var(--color-accent)_45%,white)_100%)] shadow-[0_18px_55px_-30px_rgba(16,24,40,0.28)]">
        <CardContent className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-end sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary/75">
                Current View
              </p>
              <p className="font-heading text-3xl leading-none sm:text-4xl">
                {formatINR(total)}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto sm:text-right">
            <p className="text-sm font-medium text-foreground/85">
              {expenses.length} visible expense{expenses.length !== 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total updates automatically after filters and sorting.
            </p>
          </div>
        </CardContent>
      </Card>

      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, paise]) => (
              <span
                key={cat}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm ${categoryColor(cat)}`}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                <span>{cat}</span>
                <span className="tabular-nums">{formatINR(paise / 100)}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  const widths = ["w-20", "w-16", "w-32", "w-14", "w-16"];

  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {widths.map((width, j) => (
            <TableCell key={j} className={j === 3 ? "text-right" : ""}>
              <div className={`h-3.5 animate-pulse rounded-full bg-muted ${width}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={5}>
        <div className="flex flex-col items-center py-14 text-center text-muted-foreground">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/70">
            <Inbox className="h-6 w-6 opacity-40" />
          </div>
          <p className="text-sm font-semibold text-foreground/80">
            {hasFilter ? "No expenses match this filter" : "No expenses yet"}
          </p>
          {!hasFilter && (
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first expense using the form on the left.
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

interface DeleteDialogProps {
  expense: Expense | null;
  onClose: () => void;
}

function DeleteConfirmDialog({ expense, onClose }: DeleteDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["expenses"] });
      const previousData = queryClient.getQueriesData<Expense[]>({ queryKey: ["expenses"] });
      queryClient.setQueriesData<Expense[]>(
        { queryKey: ["expenses"] },
        (old) => old?.filter((e) => e.id !== id) ?? [],
      );
      return { previousData };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Expense deleted");
    },

    onError: (err: Error, _, context) => {
      context?.previousData.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error("Could not delete expense", { description: err.message });
    },
  });

  const handleConfirm = () => {
    const id = expense!.id;
    onClose();
    mutation.mutate(id);
  };

  return (
    <AlertDialog
      open={expense !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete expense?</AlertDialogTitle>
          <AlertDialogDescription>
            {expense && (
              <>
                <span className="font-medium text-foreground">
                  {formatINR(expense.amount)}
                </span>{" "}
                · {expense.category}
                {expense.description ? ` · ${expense.description}` : ""}
                <br />
                This cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ExpenseDashboard() {
  const [category, setCategory] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading, isError, error } = useQuery({
    queryKey: ["expenses", { category, sort: sortDesc ? "date_desc" : undefined }],
    queryFn: () =>
      api.getExpenses({ category, sort: sortDesc ? "date_desc" : undefined }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  return (
    <div className="space-y-6">
      {!isLoading && !isError && <SummarySection expenses={expenses} />}

      <Card className="border-border/70 bg-card/95 shadow-[0_16px_45px_-30px_rgba(15,23,42,0.28)]">
        <CardContent className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Controls
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <label htmlFor="cat-filter" className="text-sm text-muted-foreground">
                  Category
                </label>
                <select
                  id="cat-filter"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-w-36 bg-transparent text-sm font-medium outline-none"
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <Separator orientation="vertical" className="hidden h-8 lg:block" />

              <Button
                variant={sortDesc ? "default" : "outline"}
                size="sm"
                onClick={() => setSortDesc((v) => !v)}
                className="h-10 gap-2 rounded-xl px-4"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                Newest first
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.32)]">
        <CardHeader className="border-b border-border/60 bg-muted/25 px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-2xl">Expenses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review, edit, or remove entries from the current list.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <div className="mx-5 my-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-6">
              Failed to load expenses:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/20 hover:bg-muted/20">
                <TableHead className="pl-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:pl-6">
                  Date
                </TableHead>
                <TableHead className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Category
                </TableHead>
                <TableHead className="hidden text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:table-cell">
                  Description
                </TableHead>
                <TableHead className="text-right text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="pr-5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : expenses.length === 0 ? (
                <EmptyState hasFilter={!!category} />
              ) : (
                expenses.map((e) => (
                  <TableRow key={e.id} className="border-border/50">
                    <TableCell className="pl-5 text-sm text-muted-foreground sm:pl-6">
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryColor(e.category)}`}
                      >
                        {e.category}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {e.description || (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatINR(e.amount)}
                    </TableCell>
                    <TableCell className="pr-5 text-right sm:pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingExpense(e)}
                          aria-label={`Edit expense ${formatINR(e.amount)}`}
                          className="rounded-full"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingExpense(e)}
                          aria-label={`Delete expense ${formatINR(e.amount)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditExpenseDialog
        expense={editingExpense}
        onClose={() => setEditingExpense(null)}
      />

      <DeleteConfirmDialog
        expense={deletingExpense}
        onClose={() => setDeletingExpense(null)}
      />
    </div>
  );
}
