"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import {
  addAllowancePeriod,
  addExpense,
  dateTodayInManila,
  expenseCategories,
  formatPeso,
  getCurrentAllowance,
  parsePesoToCentavos,
  removeAllowancePeriod,
  removeExpense,
  useFinanceData,
  type Expense,
  type ExpenseCategory,
} from "@/lib/offline/finance-store";

type ExpensePeriod = "day" | "week" | "month";
type AllowanceFrequency = "weekly" | "biweekly" | "monthly" | "custom";

type DateRange = {
  start: string;
  end: string;
  label: string;
};

type TrendPoint = {
  date: string;
  label: string;
  totalCentavos: number;
};

type ExpenseHistoryGroup = {
  monthKey: string;
  label: string;
  totalCentavos: number;
  expenses: Expense[];
};

const periodOptions: { value: ExpensePeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const subscribeToClient = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
}

const categoryColors: Record<ExpenseCategory, string> = {
  Food: "#3b82f6",
  Transportation: "#14b8a6",
  Snacks: "#f59e0b",
  Education: "#8b5cf6",
  "Online shopping": "#ec4899",
  "School supplies": "#22c55e",
  Printing: "#64748b",
  "Mobile data": "#06b6d4",
  Internship: "#f97316",
  Personal: "#6366f1",
  Other: "#94a3b8",
};

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(date: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function formatMonthKey(monthKey: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function getMonthBounds(monthKey: string, today: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const calendarEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  const end = monthKey === monthKeyFromDate(today) ? today : calendarEnd;

  return { start, end };
}

function getDateRange(
  period: ExpensePeriod,
  selectedDate: string,
  selectedMonth: string,
  today: string,
): DateRange {
  const monthBounds = getMonthBounds(selectedMonth, today);

  if (period === "day") {
    return {
      start: selectedDate,
      end: selectedDate,
      label: formatDate(selectedDate),
    };
  }

  if (period === "week") {
    const date = new Date(`${selectedDate}T00:00:00Z`);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    const calendarStart = shiftDate(selectedDate, -daysSinceMonday);
    const calendarEnd = shiftDate(calendarStart, 6);
    const start =
      calendarStart < monthBounds.start ? monthBounds.start : calendarStart;
    const end = calendarEnd > monthBounds.end ? monthBounds.end : calendarEnd;

    return {
      start,
      end,
      label: `${formatDate(start, false)} – ${formatDate(end)}`,
    };
  }

  return {
    start: monthBounds.start,
    end: monthBounds.end,
    label: formatMonthKey(selectedMonth),
  };
}

function datesInRange(start: string, end: string) {
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function formatCompactPeso(centavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(centavos / 100);
}

function trendLabel(date: string, period: ExpensePeriod) {
  const value = new Date(`${date}T00:00:00Z`);
  if (period === "week") {
    return new Intl.DateTimeFormat("en-PH", {
      weekday: "short",
    }).format(value);
  }
  if (period === "month") {
    return new Intl.DateTimeFormat("en-PH", {
      day: "numeric",
    }).format(value);
  }
  return formatDate(date, false);
}

function DonutChart({
  categoryTotals,
  totalCentavos,
  selectedCategory,
  onSelectCategory,
}: {
  categoryTotals: {
    name: ExpenseCategory;
    totalCentavos: number;
    percentage: number;
  }[];
  totalCentavos: number;
  selectedCategory: ExpenseCategory | null;
  onSelectCategory: (category: ExpenseCategory | null) => void;
}) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const segments = categoryTotals.map((item, index) => {
    const fraction =
      totalCentavos > 0 ? item.totalCentavos / totalCentavos : 0;
    const previousFraction = categoryTotals
      .slice(0, index)
      .reduce(
        (total, previous) =>
          total +
          (totalCentavos > 0
            ? previous.totalCentavos / totalCentavos
            : 0),
        0,
      );
    return {
      ...item,
      segmentLength: fraction * circumference,
      dashOffset: -previousFraction * circumference,
    };
  });
  const selectedItem =
    categoryTotals.find((item) => item.name === selectedCategory) ?? null;
  const centerTotal = selectedItem?.totalCentavos ?? totalCentavos;

  function handleSelect(category: ExpenseCategory) {
    onSelectCategory(selectedCategory === category ? null : category);
  }

  return (
    <div className="mt-5 grid items-center gap-6 sm:grid-cols-[210px_1fr] 2xl:grid-cols-1">
      <div className="relative mx-auto h-[210px] w-[210px]">
        <svg
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Spending by category, ${formatPeso(totalCentavos)} total`}
          className="h-full w-full -rotate-90 overflow-visible"
        >
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--surface-soft)"
            strokeWidth="22"
          />
          {segments.map((item) => {
            const isSelected = selectedCategory === item.name;
            const isDimmed =
              selectedCategory !== null && selectedCategory !== item.name;

            return (
              <circle
                key={item.name}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={categoryColors[item.name]}
                strokeWidth={isSelected ? 27 : 22}
                strokeDasharray={`${item.segmentLength} ${
                  circumference - item.segmentLength
                }`}
                strokeDashoffset={item.dashOffset}
                strokeLinecap="butt"
                opacity={isDimmed ? 0.28 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${item.name}: ${formatPeso(
                  item.totalCentavos,
                )}, ${item.percentage}%`}
                aria-pressed={isSelected}
                onClick={() => handleSelect(item.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(item.name);
                  }
                }}
                className="cursor-pointer outline-none transition-all duration-200 focus-visible:opacity-70"
              >
                <title>
                  {item.name}: {item.percentage}% (
                  {formatPeso(item.totalCentavos)})
                </title>
              </circle>
            );
          })}
        </svg>

        <button
          type="button"
          onClick={() => selectedItem && onSelectCategory(null)}
          disabled={!selectedItem}
          aria-label={
            selectedItem
              ? `Clear ${selectedItem.name} category selection`
              : "Total spending"
          }
          className="absolute inset-[42px] grid place-items-center rounded-full text-center disabled:cursor-default"
        >
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              {selectedItem?.name ?? "Total spent"}
            </span>
            <span className="mt-1 block text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">
              {formatCompactPeso(centerTotal)}
            </span>
            {selectedItem && (
              <span className="mt-1 block text-[10px] font-semibold text-[var(--muted)]">
                {selectedItem.percentage}% of this period · tap to reset
              </span>
            )}
          </span>
        </button>
      </div>

      <div className="space-y-2">
        {categoryTotals.length === 0 ? (
          <p className="rounded-[10px] bg-[var(--surface-soft)] px-4 py-5 text-center text-sm leading-6 text-[var(--muted)]">
            Add an expense to see your category percentages.
          </p>
        ) : (
          categoryTotals.map((item) => {
            const isSelected = selectedCategory === item.name;
            const isDimmed =
              selectedCategory !== null && selectedCategory !== item.name;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleSelect(item.name)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition ${
                  isSelected
                    ? "bg-[var(--surface-soft)] ring-1 ring-[var(--line)]"
                    : "hover:bg-[var(--surface-soft)]"
                } ${isDimmed ? "opacity-45" : "opacity-100"}`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColors[item.name] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ink-soft)]">
                  {item.name}
                </span>
                <span className="text-right">
                  <span className="block text-xs font-bold text-[var(--ink)]">
                    {formatPeso(item.totalCentavos)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[var(--muted)]">
                    {item.percentage}%
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function SpendingLineChart({
  points,
  period,
}: {
  points: TrendPoint[];
  period: ExpensePeriod;
}) {
  const width = 720;
  const height = 250;
  const left = 62;
  const right = 22;
  const top = 24;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(...points.map((point) => point.totalCentavos), 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? left + plotWidth / 2
        : left + (index / (points.length - 1)) * plotWidth,
    y: top + plotHeight - (point.totalCentavos / maximum) * plotHeight,
  }));
  const linePath = coordinates
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const areaPath =
    coordinates.length > 1
      ? `${linePath} L ${coordinates.at(-1)?.x} ${top + plotHeight} L ${
          coordinates[0].x
        } ${top + plotHeight} Z`
      : "";
  const labelIndexes = new Set(
    period === "month" && points.length > 8
      ? [0, 6, 13, 20, points.length - 1]
      : points.map((_, index) => index),
  );

  return (
    <div className="mt-5 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart of total expenses for the selected period"
        className="min-w-[620px] text-[var(--muted)]"
      >
        <title>Total expense trend</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + plotHeight * ratio;
          const value = Math.round(maximum * (1 - ratio));
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeDasharray={ratio === 1 ? undefined : "4 5"}
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-[var(--muted)] text-[10px]"
              >
                {formatCompactPeso(value)}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <path d={areaPath} fill="var(--chart-fill)" opacity="0.8" />
        )}
        {coordinates.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-line)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {coordinates.map((point, index) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.totalCentavos > 0 ? 4.5 : 3}
              fill={
                point.totalCentavos > 0
                  ? "var(--chart-line)"
                  : "var(--surface)"
              }
              stroke="var(--chart-line)"
              strokeWidth="2"
            >
              <title>
                {point.label}: {formatPeso(point.totalCentavos)}
              </title>
            </circle>
            {labelIndexes.has(index) && (
              <text
                x={point.x}
                y={height - 18}
                textAnchor="middle"
                className="fill-[var(--muted)] text-[10px]"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function FinanceClient({ userId }: { userId: string }) {
  const confirm = useConfirmation();
  const { allowancePeriods, expenses } = useFinanceData(userId);
  const isClient = useIsClient();
  const [today] = useState(dateTodayInManila);
  const currentMonth = monthKeyFromDate(today);
  const [period, setPeriod] = useState<ExpensePeriod>("day");
  const [dashboardMonth, setDashboardMonth] = useState(currentMonth);
  const [dashboardDate, setDashboardDate] = useState(today);
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategory | null>(null);
  const [historyMonth, setHistoryMonth] = useState<string>(currentMonth);
  const [showAllowance, setShowAllowance] = useState(false);

  const [expenseAmount, setExpenseAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [expenseDate, setExpenseDate] = useState(today);
  const [description, setDescription] = useState("");
  const [expenseError, setExpenseError] = useState("");

  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [frequency, setFrequency] =
    useState<AllowanceFrequency>("weekly");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(shiftDate(today, 6));
  const [allowanceNotes, setAllowanceNotes] = useState("");
  const [allowanceError, setAllowanceError] = useState("");

  const currentAllowance = getCurrentAllowance(allowancePeriods, today);

  const dashboardMonthOptions = useMemo(() => {
    const monthKeys = new Set(
      expenses.map((expense) => monthKeyFromDate(expense.date)),
    );
    monthKeys.add(currentMonth);
    return Array.from(monthKeys).sort((left, right) =>
      right.localeCompare(left),
    );
  }, [currentMonth, expenses]);

  const dashboardMonthBounds = useMemo(
    () => getMonthBounds(dashboardMonth, today),
    [dashboardMonth, today],
  );

  const dateRange = useMemo(
    () => getDateRange(period, dashboardDate, dashboardMonth, today),
    [dashboardDate, dashboardMonth, period, today],
  );
  const periodExpenses = useMemo(
    () =>
      expenses
        .filter(
          (expense) =>
            expense.date >= dateRange.start && expense.date <= dateRange.end,
        )
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) ||
            right.createdAt.localeCompare(left.createdAt),
        ),
    [dateRange.end, dateRange.start, expenses],
  );
  const totalCentavos = periodExpenses.reduce(
    (total, expense) => total + expense.amountCentavos,
    0,
  );
  const dashboardYear = dashboardMonth.slice(0, 4);
  const yearlyExpenses = useMemo(
    () =>
      expenses.filter((expense) => expense.date.startsWith(`${dashboardYear}-`)),
    [dashboardYear, expenses],
  );
  const yearlyTotalCentavos = yearlyExpenses.reduce(
    (total, expense) => total + expense.amountCentavos,
    0,
  );
  const categoryTotals = expenseCategories
    .map((name) => {
      const total = periodExpenses
        .filter((expense) => expense.category === name)
        .reduce((sum, expense) => sum + expense.amountCentavos, 0);
      return {
        name,
        totalCentavos: total,
        percentage:
          totalCentavos > 0 ? Math.round((total / totalCentavos) * 100) : 0,
      };
    })
    .filter((item) => item.totalCentavos > 0)
    .sort((left, right) => right.totalCentavos - left.totalCentavos);
  const biggestCategory = categoryTotals[0];
  const trendPoints: TrendPoint[] = datesInRange(
    dateRange.start,
    dateRange.end,
  ).map((date) => ({
    date,
    label: trendLabel(date, period),
    totalCentavos: periodExpenses
      .filter((expense) => expense.date === date)
      .reduce((total, expense) => total + expense.amountCentavos, 0),
  }));

  const historyMonthOptions = useMemo(() => {
    const monthKeys = new Set(
      expenses.map((expense) => monthKeyFromDate(expense.date)),
    );
    monthKeys.add(monthKeyFromDate(today));
    return Array.from(monthKeys).sort((left, right) =>
      right.localeCompare(left),
    );
  }, [expenses, today]);

  const historyExpenses = useMemo(
    () =>
      expenses
        .filter(
          (expense) =>
            historyMonth === "all" ||
            monthKeyFromDate(expense.date) === historyMonth,
        )
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) ||
            right.createdAt.localeCompare(left.createdAt),
        ),
    [expenses, historyMonth],
  );

  const historyGroups = useMemo<ExpenseHistoryGroup[]>(() => {
    const groups = new Map<string, Expense[]>();

    historyExpenses.forEach((expense) => {
      const monthKey = monthKeyFromDate(expense.date);
      const group = groups.get(monthKey) ?? [];
      group.push(expense);
      groups.set(monthKey, group);
    });

    return Array.from(groups.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([monthKey, monthExpenses]) => ({
        monthKey,
        label: formatMonthKey(monthKey),
        totalCentavos: monthExpenses.reduce(
          (total, expense) => total + expense.amountCentavos,
          0,
        ),
        expenses: monthExpenses,
      }));
  }, [historyExpenses]);

  function handleDashboardMonthChange(nextMonth: string) {
    const nextBounds = getMonthBounds(nextMonth, today);
    const latestExpenseDate = expenses
      .filter((expense) => monthKeyFromDate(expense.date) === nextMonth)
      .map((expense) => expense.date)
      .sort((left, right) => right.localeCompare(left))[0];

    setDashboardMonth(nextMonth);
    setDashboardDate(
      nextMonth === currentMonth
        ? today
        : latestExpenseDate ?? nextBounds.end,
    );
    setSelectedCategory(null);
  }

  function handleDashboardDateChange(nextDate: string) {
    setDashboardDate(nextDate);
    setSelectedCategory(null);
  }

  function handlePeriodChange(nextPeriod: ExpensePeriod) {
    setPeriod(nextPeriod);
    setSelectedCategory(null);
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError("");
    const amountCentavos = parsePesoToCentavos(expenseAmount);
    if (!amountCentavos) {
      setExpenseError("Enter a valid amount greater than ₱0.00.");
      return;
    }
    if (!expenseDate || expenseDate > today) {
      setExpenseError("Choose today or an earlier date.");
      return;
    }
    if (category === "Other" && !description.trim()) {
      setExpenseError("Describe the expense when the category is Other.");
      return;
    }

    const shouldProceed = await confirm({
      title: "Save this expense?",
      message: `${formatPeso(amountCentavos)} for ${
        description.trim() || category
      } will be added to your expense records.`,
      confirmLabel: "Save expense",
    });
    if (!shouldProceed) return;

    addExpense(userId, {
      amountCentavos,
      category,
      date: expenseDate,
      paymentMethod: "Other",
      description: description.trim(),
    });
    setExpenseAmount("");
    setDescription("");
    setExpenseDate(today);
  }

  function handleFrequencyChange(nextFrequency: AllowanceFrequency) {
    setFrequency(nextFrequency);
    if (nextFrequency === "weekly") setEndDate(shiftDate(startDate, 6));
    if (nextFrequency === "biweekly") setEndDate(shiftDate(startDate, 13));
    if (nextFrequency === "monthly") setEndDate(shiftDate(startDate, 29));
  }

  function handleStartDateChange(nextDate: string) {
    setStartDate(nextDate);
    if (frequency === "weekly") setEndDate(shiftDate(nextDate, 6));
    if (frequency === "biweekly") setEndDate(shiftDate(nextDate, 13));
    if (frequency === "monthly") setEndDate(shiftDate(nextDate, 29));
  }

  async function handleAllowanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAllowanceError("");
    const amountCentavos = parsePesoToCentavos(allowanceAmount);
    if (!amountCentavos) {
      setAllowanceError("Enter a valid allowance greater than ₱0.00.");
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setAllowanceError("The end date must be on or after the start date.");
      return;
    }
    const overlaps = allowancePeriods.some(
      (item) => startDate <= item.endDate && endDate >= item.startDate,
    );
    if (overlaps) {
      setAllowanceError(
        "This date range overlaps an existing allowance period.",
      );
      return;
    }

    const shouldProceed = await confirm({
      title: "Save this allowance?",
      message: `${formatPeso(amountCentavos)} will be tracked from ${formatDate(
        startDate,
      )} to ${formatDate(endDate)}.`,
      confirmLabel: "Save allowance",
    });
    if (!shouldProceed) return;

    addAllowancePeriod(userId, {
      amountCentavos,
      frequency,
      startDate,
      endDate,
      notes: allowanceNotes.trim(),
    });
    setAllowanceAmount("");
    setAllowanceNotes("");
    setShowAllowance(false);
  }

  async function handleDeleteExpense(expense: Expense) {
    const shouldProceed = await confirm({
      title: "Delete this expense?",
      message: `${formatPeso(expense.amountCentavos)} for ${
        expense.description || expense.category
      } will be permanently removed.`,
      confirmLabel: "Delete expense",
      tone: "danger",
    });
    if (shouldProceed) removeExpense(userId, expense.id);
  }

  async function handleDeleteAllowance() {
    if (!currentAllowance) return;
    const shouldProceed = await confirm({
      title: "Remove this allowance?",
      message:
        "The allowance period will be removed. Your expense records will remain.",
      confirmLabel: "Remove allowance",
      tone: "danger",
    });
    if (shouldProceed) {
      removeAllowancePeriod(userId, currentAllowance.id);
    }
  }

  if (!isClient) {
    return (
      <>
        <DashboardPageHeader
          eyebrow="Money tracker"
          title="Expenses"
          description="Record what you spent and review any saved day, week, month, or year."
        />
        <section
          aria-live="polite"
          className="mt-5 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]"
        >
          Loading your saved expense records…
        </section>
      </>
    );
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Money tracker"
        title="Expenses"
        description="Record what you spent and review any saved day, week, month, or year."
        action={
          <button
            type="button"
            onClick={() => {
              setAllowanceError("");
              setShowAllowance((value) => !value);
            }}
            className="secondary-button w-full px-5 sm:w-auto"
          >
            <Icon name="wallet" className="h-4 w-4" />
            {currentAllowance ? "Manage allowance" : "Optional allowance"}
          </button>
        }
      />

      {showAllowance && (
        <section className="mt-5 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Optional budget
              </p>
              <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                {currentAllowance
                  ? `${formatPeso(currentAllowance.amountCentavos)} allowance`
                  : "Set an allowance period"}
              </h2>
              {currentAllowance && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatDate(currentAllowance.startDate)} –{" "}
                  {formatDate(currentAllowance.endDate)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentAllowance && (
                <button
                  type="button"
                  onClick={handleDeleteAllowance}
                  className="rounded-[8px] px-3 py-2 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAllowance(false)}
                className="rounded-[8px] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              >
                Close
              </button>
            </div>
          </div>

          {!currentAllowance && (
            <form onSubmit={handleAllowanceSubmit} className="mt-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label
                    htmlFor="allowance-amount"
                    className="mb-2 block text-xs font-bold text-[var(--ink-soft)]"
                  >
                    Amount
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-bold text-[var(--muted)]">
                      ₱
                    </span>
                    <input
                      id="allowance-amount"
                      inputMode="decimal"
                      value={allowanceAmount}
                      onChange={(event) =>
                        setAllowanceAmount(event.target.value)
                      }
                      placeholder="1,500.00"
                      required
                      className="form-input"
                      style={{ paddingLeft: "3rem" }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="allowance-frequency"
                    className="mb-2 block text-xs font-bold text-[var(--ink-soft)]"
                  >
                    Frequency
                  </label>
                  <select
                    id="allowance-frequency"
                    value={frequency}
                    onChange={(event) =>
                      handleFrequencyChange(
                        event.target.value as AllowanceFrequency,
                      )
                    }
                    className="form-input"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="allowance-start"
                    className="mb-2 block text-xs font-bold text-[var(--ink-soft)]"
                  >
                    Start
                  </label>
                  <input
                    id="allowance-start"
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      handleStartDateChange(event.target.value)
                    }
                    required
                    className="form-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="allowance-end"
                    className="mb-2 block text-xs font-bold text-[var(--ink-soft)]"
                  >
                    End
                  </label>
                  <input
                    id="allowance-end"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    required
                    className="form-input"
                  />
                </div>
              </div>
              <input
                value={allowanceNotes}
                onChange={(event) => setAllowanceNotes(event.target.value)}
                placeholder="Optional note"
                className="form-input mt-4"
                aria-label="Allowance note"
              />
              {allowanceError && (
                <p
                  role="alert"
                  className="mt-4 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)] dark:border-red-900"
                >
                  {allowanceError}
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <button type="submit" className="primary-button px-5">
                  Save allowance
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 xl:sticky xl:top-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
            Quick entry
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--ink)]">
            What did you spend?
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Add one purchase at a time. Your charts update immediately.
          </p>

          <form onSubmit={handleExpenseSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="expense-amount"
                className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
              >
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-bold text-[var(--muted)]">
                  ₱
                </span>
                <input
                  id="expense-amount"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="form-input h-14 text-lg font-bold"
                  style={{ paddingLeft: "3.25rem" }}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="expense-category"
                className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
              >
                Category
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(event) => {
                  const nextCategory = event.target.value as ExpenseCategory;
                  setCategory(nextCategory);
                  if (nextCategory !== "Other") {
                    setDescription("");
                  }
                }}
                className="form-input"
              >
                {expenseCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="expense-date"
                className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
              >
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                max={today}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
                className="form-input"
              />
            </div>
            {category === "Other" && (
              <div>
                <label
                  htmlFor="expense-description"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Describe this expense
                </label>
                <input
                  id="expense-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="e.g. Medicine, laundry, or organization fee"
                  required
                  className="form-input"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Enter the category that best describes what you spent on.
                </p>
              </div>
            )}
            {expenseError && (
              <p
                role="alert"
                className="rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)] dark:border-red-900"
              >
                {expenseError}
              </p>
            )}
            <button type="submit" className="primary-button w-full px-5">
              <Icon name="plus" className="h-4 w-4" />
              Save expense
            </button>
          </form>
        </section>

        <div className="min-w-0">
          <section className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                  Spending dashboard
                </p>
                <h2 className="mt-1 text-lg font-bold text-[var(--ink)]">
                  {dateRange.label}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Browsing saved expenses from {formatMonthKey(dashboardMonth)}.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
                <div>
                  <label
                    htmlFor="dashboard-expense-month"
                    className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]"
                  >
                    Month
                  </label>
                  <select
                    id="dashboard-expense-month"
                    value={dashboardMonth}
                    onChange={(event) =>
                      handleDashboardMonthChange(event.target.value)
                    }
                    className="form-input min-w-[190px] py-2 text-sm"
                  >
                    {dashboardMonthOptions.map((monthKey) => (
                      <option key={monthKey} value={monthKey}>
                        {formatMonthKey(monthKey)}
                      </option>
                    ))}
                  </select>
                </div>

                {period !== "month" && (
                  <div>
                    <label
                      htmlFor="dashboard-expense-date"
                      className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      {period === "day" ? "Specific day" : "A day in the week"}
                    </label>
                    <input
                      id="dashboard-expense-date"
                      type="date"
                      value={dashboardDate}
                      min={dashboardMonthBounds.start}
                      max={dashboardMonthBounds.end}
                      onChange={(event) =>
                        handleDashboardDateChange(event.target.value)
                      }
                      className="form-input min-w-[170px] py-2 text-sm"
                    />
                  </div>
                )}

                <div>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                    View
                  </span>
                  <div
                    role="group"
                    aria-label="Expense period"
                    className="grid grid-cols-3 rounded-[11px] bg-[var(--surface-soft)] p-1"
                  >
                    {periodOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePeriodChange(option.value)}
                        aria-pressed={period === option.value}
                        className={`min-h-9 rounded-[8px] px-3 text-xs font-bold ${
                          period === option.value
                            ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                            : "text-[var(--muted)] hover:text-[var(--ink)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-label="Expense summary"
            className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
          >
            <article className="rounded-[15px] border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                Selected period
              </p>
              <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                {formatPeso(totalCentavos)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {dateRange.label}
              </p>
            </article>

            <article className="rounded-[15px] border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                Total expenses
              </p>
              <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                {formatPeso(yearlyTotalCentavos)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Entire year of {dashboardYear}
              </p>
            </article>

            <article className="rounded-[15px] border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                Transactions
              </p>
              <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                {periodExpenses.length}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {yearlyExpenses.length} in {dashboardYear}
              </p>
            </article>

            <article className="rounded-[15px] border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                Biggest category
              </p>
              <p className="mt-3 truncate text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">
                {biggestCategory?.name ?? "No spending"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {biggestCategory
                  ? `${biggestCategory.percentage}% of this period`
                  : "Nothing recorded yet"}
              </p>
            </article>
          </section>

          <div className="mt-4 grid gap-4 2xl:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Categories
              </p>
              <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                Where your money went
              </h2>
              <DonutChart
                categoryTotals={categoryTotals}
                totalCentavos={totalCentavos}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </section>

            <section className="min-w-0 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Trend
              </p>
              <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                Total expenses over time
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {period === "day"
                  ? `Spending recorded on ${formatDate(dashboardDate)}`
                  : period === "week"
                    ? "Daily totals for the selected week"
                    : `Daily totals for ${formatMonthKey(dashboardMonth)}`}
              </p>
              <SpendingLineChart points={trendPoints} period={period} />
            </section>
          </div>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">
              Expense history
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {historyMonth === "all"
                ? "All saved transactions, organized by month and year."
                : `Transactions for ${formatMonthKey(historyMonth)}.`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor="expense-history-month"
              className="sr-only"
            >
              Expense history month
            </label>
            <select
              id="expense-history-month"
              value={historyMonth}
              onChange={(event) => setHistoryMonth(event.target.value)}
              className="form-input min-w-[220px] py-2 text-sm"
            >
              <option value="all">All months and years</option>
              {historyMonthOptions.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthKey(monthKey)}
                </option>
              ))}
            </select>

            <span className="self-start rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--muted-strong)] sm:self-auto">
              {historyExpenses.length}{" "}
              {historyExpenses.length === 1 ? "transaction" : "transactions"}
            </span>
          </div>
        </header>

        {historyExpenses.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center p-8 text-center">
            <div className="max-w-[360px]">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--surface-blue)] text-[var(--blue)]">
                <Icon name="wallet" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                No expenses for this month
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Your other months remain saved. Choose another month or add a
                new expense using the quick entry form.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {historyGroups.map((group) => (
              <div key={group.monthKey}>
                {historyMonth === "all" && (
                  <div className="flex flex-col gap-1 border-b border-[var(--line)] bg-[var(--surface-soft)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {group.label}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {group.expenses.length}{" "}
                        {group.expenses.length === 1
                          ? "transaction"
                          : "transactions"}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[var(--ink)]">
                      {formatPeso(group.totalCentavos)}
                    </p>
                  </div>
                )}

                <div className="divide-y divide-[var(--line)]">
                  {group.expenses.map((expense) => (
                    <article
                      key={expense.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              categoryColors[expense.category] ??
                              categoryColors.Other,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--ink)]">
                            {expense.description || expense.category}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {expense.category} · {formatDate(expense.date)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <p className="text-sm font-bold text-[var(--ink)]">
                          −{formatPeso(expense.amountCentavos)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense)}
                          aria-label={`Delete ${
                            expense.description || expense.category
                          } expense`}
                          className="rounded-[7px] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}