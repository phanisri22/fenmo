"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getIdempotencyKey, rotateIdempotencyKey } from "@/lib/idempotency";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      "Amount must be greater than zero",
    )
    .refine((v) => !/\.\d{3,}/.test(v), "At most 2 decimal places"),
  category: z.string().min(1, "Category is required"),
  description: z.string(),
  date: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof schema>;

export function AddExpenseForm() {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", category: "", description: "", date: today },
  });

  const mutation = useMutation({
    mutationFn: api.createExpense,
    onSuccess: (expense) => {
      reset({ amount: "", category: "", description: "", date: today });
      rotateIdempotencyKey();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Expense added", {
        description: `${formatINR(expense.amount)} · ${expense.category}`,
      });
    },
    onError: (err: Error) => {
      toast.error("Could not save expense", { description: err.message });
      // Idempotency key is intentionally not rotated on error so the user
      // can safely retry and the server will deduplicate.
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      idempotency_key: getIdempotencyKey(),
      amount: parseFloat(values.amount).toFixed(2),
      category: values.category.trim(),
      description: values.description.trim(),
      date: values.date,
    });
  };

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-accent/50 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <PlusCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary/75">
              New Entry
            </p>
            <CardTitle className="font-heading text-2xl leading-tight">
              Add an expense
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Log a payment with the amount, category, date, and an optional note.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-5 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Amount (₹)
              </Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                aria-invalid={!!errors.amount}
                className="h-11 rounded-xl border-border/70 bg-background/80"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                aria-invalid={!!errors.date}
                className="h-11 rounded-xl border-border/70 bg-background/80"
                {...register("date")}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Category
              </Label>
              <Input
                id="category"
                placeholder="Food, transport, bills..."
                list="category-suggestions"
                autoComplete="off"
                aria-invalid={!!errors.category}
                className="h-11 rounded-xl border-border/70 bg-background/80"
                {...register("category")}
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Description
              </Label>
              <Input
                id="description"
                placeholder="Brief note"
                className="h-11 rounded-xl border-border/70 bg-background/80"
                {...register("description")}
              />
              <p className="text-xs text-muted-foreground">Optional context for this transaction.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Duplicate submits stay safe with the existing retry protection.
            </p>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-11 rounded-xl px-5 shadow-[0_12px_30px_-18px_var(--color-primary)] sm:min-w-40"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Expense"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
