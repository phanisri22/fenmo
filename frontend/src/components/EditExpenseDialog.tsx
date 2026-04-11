"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Validation (same rules as create) ────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────

interface EditExpenseDialogProps {
  expense: Expense | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function EditExpenseDialog({ expense, onClose }: EditExpenseDialogProps) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Pre-fill the form whenever a different expense is opened for editing.
  useEffect(() => {
    if (expense) {
      reset({
        amount: expense.amount.toFixed(2),
        category: expense.category,
        description: expense.description,
        date: expense.date,
      });
    }
  }, [expense, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.updateExpense(expense!.id, {
        amount: parseFloat(values.amount).toFixed(2),
        category: values.category.trim(),
        description: values.description.trim(),
        date: values.date,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Expense updated", {
        description: `${formatINR(updated.amount)} · ${updated.category}`,
      });
      onClose();
    },
    onError: (err: Error) => {
      toast.error("Could not update expense", { description: err.message });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <Dialog
      open={expense !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Expense
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Amount (₹)</Label>
              <Input
                id="edit-amount"
                type="number"
                min="0.01"
                step="0.01"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                aria-invalid={!!errors.date}
                {...register("date")}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                list="edit-category-suggestions"
                autoComplete="off"
                aria-invalid={!!errors.category}
                {...register("category")}
              />
              <datalist id="edit-category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">
                Description{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Input id="edit-description" {...register("description")} />
            </div>
          </div>

          <DialogFooter className="mt-2" showCloseButton={!mutation.isPending}>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
