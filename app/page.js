"use client";

import { useState } from "react";
import { firebaseReady } from "@/lib/firebase";
import { shiftMonth } from "@/lib/expense-utils";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useProfile } from "@/hooks/useProfile";
import { useExpensesData } from "@/hooks/useExpensesData";
import { usePeopleProfiles } from "@/hooks/usePeopleProfiles";
import { useCategories } from "@/hooks/useCategories";
import { useBudget } from "@/hooks/useBudget";
import { useLedgerInsights } from "@/hooks/useLedgerInsights";

import { ConnectDatabaseScreen } from "@/components/connect-database-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { ProfileSetupScreen } from "@/components/profile-setup-screen";
import { AppHeader } from "@/components/app-header";
import { ViewTabs } from "@/components/view-tabs";
import { ExpenseForm } from "@/components/expense-form";
import { MonthSummaryCard } from "@/components/month-summary-card";
import { ExpenseList } from "@/components/expense-list";
import { InsightsPanel } from "@/components/insights-panel";
import { BalancesPanel } from "@/components/balances-panel";
import { Toast } from "@/components/toast";

export default function Home() {
  const [toast, setToast] = useState("");
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  const { user, authLoading, authError, handleSignIn, handleSignOut } = useAuthUser(showToast);
  const { profile, profileLoading, saveProfile } = useProfile(user, showToast);
  const { expenses, settlements, loading } = useExpensesData(user, showToast);
  const peopleProfiles = usePeopleProfiles(user, expenses, settlements);
  const { categories, categoryByKey, categoryRows, saveCategories } = useCategories(
    user,
    expenses,
    showToast
  );
  const { budget, saveBudget } = useBudget(user, showToast);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = useState("ledger");

  const {
    total,
    deltaPct,
    categoryTotals,
    maxCategoryAmount,
    groupedList,
    dailySeries,
    maxDaily,
    sixMonthSeries,
    maxSixMonth,
    balances,
    recentPeople,
  } = useLedgerInsights(expenses, settlements, user, viewMonth, peopleProfiles);

  function shiftViewMonth(delta) {
    setViewMonth((m) => shiftMonth(m, delta));
  }

  if (!firebaseReady) return <ConnectDatabaseScreen />;
  if (authLoading) return <LoadingScreen />;
  if (!user) return <SignInScreen authError={authError} onSignIn={handleSignIn} />;
  if (profileLoading) return <LoadingScreen />;
  if (!profile) return <ProfileSetupScreen user={user} onSave={saveProfile} />;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pb-20 pt-7 sm:px-5">
      <AppHeader profile={profile} onSignOut={handleSignOut} />

      <ViewTabs view={view} onChange={setView} hasBalances={balances.length > 0} />

      {view === "ledger" && (
        <>
          <ExpenseForm
            user={user}
            categories={categories}
            categoryByKey={categoryByKey}
            categoryRows={categoryRows}
            recentPeople={recentPeople}
            saveCategories={saveCategories}
            onError={showToast}
          />
          <MonthSummaryCard
            viewMonth={viewMonth}
            onShiftMonth={shiftViewMonth}
            total={total}
            deltaPct={deltaPct}
            budget={budget}
            saveBudget={saveBudget}
          />
          <ExpenseList
            loading={loading}
            groupedList={groupedList}
            viewMonth={viewMonth}
            user={user}
            peopleProfiles={peopleProfiles}
            onError={showToast}
          />
        </>
      )}

      {view === "insights" && (
        <InsightsPanel
          viewMonth={viewMonth}
          onShiftMonth={shiftViewMonth}
          total={total}
          categoryTotals={categoryTotals}
          maxCategoryAmount={maxCategoryAmount}
          dailySeries={dailySeries}
          maxDaily={maxDaily}
          sixMonthSeries={sixMonthSeries}
          maxSixMonth={maxSixMonth}
        />
      )}

      {view === "balances" && (
        <BalancesPanel
          balances={balances}
          peopleProfiles={peopleProfiles}
          user={user}
          onError={showToast}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
