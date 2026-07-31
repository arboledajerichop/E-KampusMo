"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  flushCloudDeletes,
  queueCloudDelete,
  runCloudTask,
} from "@/lib/supabase/cloud-sync";

export const expenseCategories = [
  "Food",
  "Transportation",
  "Snacks",
  "Education",
  "Online shopping",
  "School supplies",
  "Printing",
  "Mobile data",
  "Internship",
  "Personal",
  "Other",
] as const;

export const paymentMethods = [
  "Cash",
  "GCash",
  "Maya",
  "Debit card",
  "Credit card",
  "Bank transfer",
  "Other",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type PaymentMethod = (typeof paymentMethods)[number];

export type AllowancePeriod = {
  id: string;
  amountCentavos: number;
  frequency: "weekly" | "biweekly" | "monthly" | "custom";
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  amountCentavos: number;
  category: ExpenseCategory;
  date: string;
  paymentMethod: PaymentMethod;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type FinanceData = {
  version: 1;
  allowancePeriods: AllowancePeriod[];
  expenses: Expense[];
};

type AllowanceInput = Omit<
  AllowancePeriod,
  "id" | "createdAt" | "updatedAt"
>;
type ExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;

const EMPTY_DATA: FinanceData = {
  version: 1,
  allowancePeriods: [],
  expenses: [],
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-finance-change";

function storageKey(userId: string) {
  return `ekampusmo:${userId}:offline-finance-v1`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseFinanceData(serialized: string | null): FinanceData {
  if (!serialized) {
    return EMPTY_DATA;
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<FinanceData>;
    return {
      version: 1,
      allowancePeriods: Array.isArray(parsed.allowancePeriods)
        ? parsed.allowancePeriods
        : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

function readSerialized(userId: string) {
  if (typeof window === "undefined") {
    return EMPTY_SERIALIZED;
  }

  return window.localStorage.getItem(storageKey(userId)) ?? EMPTY_SERIALIZED;
}

function writeData(userId: string, data: FinanceData) {
  const key = storageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { key },
    }),
  );
}

function allowanceRow(userId: string, period: AllowancePeriod) {
  return {
    id: period.id,
    user_id: userId,
    amount_centavos: period.amountCentavos,
    frequency: period.frequency,
    start_date: period.startDate,
    end_date: period.endDate,
    notes: period.notes,
    created_at: period.createdAt,
    updated_at: period.updatedAt,
  };
}

function expenseRow(userId: string, expense: Expense) {
  return {
    id: expense.id,
    user_id: userId,
    amount_centavos: expense.amountCentavos,
    category: expense.category,
    date: expense.date,
    payment_method: expense.paymentMethod,
    description: expense.description,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
  };
}

function allowanceFromRow(row: Record<string, unknown>): AllowancePeriod {
  return {
    id: String(row.id),
    amountCentavos: Number(row.amount_centavos),
    frequency: row.frequency as AllowancePeriod["frequency"],
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function expenseFromRow(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    amountCentavos: Number(row.amount_centavos),
    category: row.category as ExpenseCategory,
    date: String(row.date),
    paymentMethod: row.payment_method as PaymentMethod,
    description: String(row.description ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function syncFinanceData(userId: string) {
  await runCloudTask(async () => {
    const supabase = createClient();
    await flushCloudDeletes(supabase, userId, [
      "expenses",
      "allowance_periods",
    ]);
    const local = readFinanceData(userId);
    const [existingPeriods, existingExpenses] = await Promise.all([
      supabase.from("allowance_periods").select("*").eq("user_id", userId),
      supabase.from("expenses").select("*").eq("user_id", userId),
    ]);
    if (existingPeriods.error) throw existingPeriods.error;
    if (existingExpenses.error) throw existingExpenses.error;
    const cloudPeriodTimes = new Map(
      (existingPeriods.data ?? []).map((row) => [
        String(row.id),
        String(row.updated_at),
      ]),
    );
    const cloudExpenseTimes = new Map(
      (existingExpenses.data ?? []).map((row) => [
        String(row.id),
        String(row.updated_at),
      ]),
    );
    const periodsToUpload = local.allowancePeriods.filter((period) => {
      const cloudUpdatedAt = cloudPeriodTimes.get(period.id);
      return !cloudUpdatedAt || period.updatedAt > cloudUpdatedAt;
    });
    const expensesToUpload = local.expenses.filter((expense) => {
      const cloudUpdatedAt = cloudExpenseTimes.get(expense.id);
      return !cloudUpdatedAt || expense.updatedAt > cloudUpdatedAt;
    });

    if (periodsToUpload.length > 0) {
      const { error } = await supabase
        .from("allowance_periods")
        .upsert(
          periodsToUpload.map((period) => allowanceRow(userId, period)),
        );
      if (error) throw error;
    }
    if (expensesToUpload.length > 0) {
      const { error } = await supabase
        .from("expenses")
        .upsert(expensesToUpload.map((expense) => expenseRow(userId, expense)));
      if (error) throw error;
    }

    const [periodsResult, expensesResult] = await Promise.all([
      supabase
        .from("allowance_periods")
        .select("*")
        .eq("user_id", userId)
        .order("start_date"),
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false }),
    ]);
    if (periodsResult.error) throw periodsResult.error;
    if (expensesResult.error) throw expensesResult.error;
    writeData(userId, {
      version: 1,
      allowancePeriods: (periodsResult.data ?? []).map(allowanceFromRow),
      expenses: (expensesResult.data ?? []).map(expenseFromRow),
    });
  });
}

function upsertAllowanceInCloud(userId: string, period: AllowancePeriod) {
  void runCloudTask(async () => {
    const { error } = await createClient()
      .from("allowance_periods")
      .upsert(allowanceRow(userId, period));
    if (error) throw error;
  });
}

function upsertExpenseInCloud(userId: string, expense: Expense) {
  void runCloudTask(async () => {
    const { error } = await createClient()
      .from("expenses")
      .upsert(expenseRow(userId, expense));
    if (error) throw error;
  });
}

export function readFinanceData(userId: string) {
  return parseFinanceData(readSerialized(userId));
}

export function parsePesoToCentavos(value: string) {
  const normalized = value.replaceAll(",", "").trim();

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");
  const whole = Number(wholePart);
  const centavos = Number(decimalPart.padEnd(2, "0"));
  const total = whole * 100 + centavos;

  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function formatPeso(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

export function dateTodayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function inclusiveDayCount(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 86_400_000) + 1;
}

export function addAllowancePeriod(userId: string, input: AllowanceInput) {
  const data = readFinanceData(userId);
  const timestamp = new Date().toISOString();
  const period: AllowancePeriod = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  writeData(userId, {
    ...data,
    allowancePeriods: [...data.allowancePeriods, period],
  });
  upsertAllowanceInCloud(userId, period);

  return period;
}

export function removeAllowancePeriod(userId: string, periodId: string) {
  const data = readFinanceData(userId);
  writeData(userId, {
    ...data,
    allowancePeriods: data.allowancePeriods.filter(
      (period) => period.id !== periodId,
    ),
  });
  queueCloudDelete(userId, "allowance_periods", periodId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["allowance_periods"]),
  );
}

export function addExpense(userId: string, input: ExpenseInput) {
  const data = readFinanceData(userId);
  const timestamp = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  writeData(userId, {
    ...data,
    expenses: [...data.expenses, expense],
  });
  upsertExpenseInCloud(userId, expense);

  return expense;
}

export function removeExpense(userId: string, expenseId: string) {
  const data = readFinanceData(userId);
  writeData(userId, {
    ...data,
    expenses: data.expenses.filter((expense) => expense.id !== expenseId),
  });
  queueCloudDelete(userId, "expenses", expenseId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["expenses"]),
  );
}

export function getCurrentAllowance(
  allowancePeriods: AllowancePeriod[],
  today = dateTodayInManila(),
) {
  return allowancePeriods
    .filter((period) => period.startDate <= today && period.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export function calculateFinanceSummary(
  period: AllowancePeriod | undefined,
  expenses: Expense[],
  today = dateTodayInManila(),
) {
  if (!period) {
    return {
      periodExpenses: [] as Expense[],
      totalSpentCentavos: 0,
      remainingCentavos: 0,
      elapsedDays: 0,
      daysRemaining: 0,
      averageDailyCentavos: 0,
      suggestedDailyCentavos: 0,
      forecastBalanceCentavos: 0,
    };
  }

  const periodExpenses = expenses.filter(
    (expense) =>
      expense.date >= period.startDate && expense.date <= period.endDate,
  );
  const totalSpentCentavos = periodExpenses.reduce(
    (total, expense) => total + expense.amountCentavos,
    0,
  );
  const remainingCentavos = period.amountCentavos - totalSpentCentavos;
  const effectiveToday =
    today < period.startDate
      ? period.startDate
      : today > period.endDate
        ? period.endDate
        : today;
  const totalDays = inclusiveDayCount(period.startDate, period.endDate);
  const elapsedDays = inclusiveDayCount(period.startDate, effectiveToday);
  const daysRemaining = inclusiveDayCount(effectiveToday, period.endDate);
  const averageDailyCentavos =
    elapsedDays > 0 ? Math.round(totalSpentCentavos / elapsedDays) : 0;
  const suggestedDailyCentavos =
    daysRemaining > 0
      ? Math.max(0, Math.floor(remainingCentavos / daysRemaining))
      : 0;
  const forecastBalanceCentavos =
    period.amountCentavos - averageDailyCentavos * totalDays;

  return {
    periodExpenses,
    totalSpentCentavos,
    remainingCentavos,
    elapsedDays,
    daysRemaining,
    averageDailyCentavos,
    suggestedDailyCentavos,
    forecastBalanceCentavos,
  };
}

export function useFinanceData(userId: string) {
  useEffect(() => {
    void syncFinanceData(userId);
  }, [userId]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const key = storageKey(userId);

      function handleStorage(event: StorageEvent) {
        if (event.key === key) {
          onStoreChange();
        }
      }

      function handleLocalChange(event: Event) {
        const detail = (event as CustomEvent<{ key?: string }>).detail;
        if (detail?.key === key) {
          onStoreChange();
        }
      }

      window.addEventListener("storage", handleStorage);
      window.addEventListener(CHANGE_EVENT, handleLocalChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(CHANGE_EVENT, handleLocalChange);
      };
    },
    [userId],
  );
  const getSnapshot = useCallback(() => readSerialized(userId), [userId]);
  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_SERIALIZED,
  );

  return useMemo(() => parseFinanceData(serialized), [serialized]);
}
