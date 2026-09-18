/**
 * Landing page.
 *
 * Mobile-first: a single flowing column that becomes an asymmetric two-column
 * composition from `lg` up. Section shapes deliberately differ — a hero, a
 * numeric strip, a feature grid with one spanning focal card, a closing panel —
 * so no two blocks read as the same template.
 */

import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { HeroTimeline } from "@/components/landing/hero-timeline";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-media-query";
import { useSession } from "@/hooks/use-session";
import {
  HOURS_PER_DAY,
  SLOTS_PER_DAY,
  SLOTS_PER_HOUR,
  SLOT_MINUTES,
} from "@/lib/timeline-geometry";

/** Numbers that are true by construction, read from the renderer's constants. */
const FACTS: { value: string; label: string; note: string }[] = [
  {
    value: `${SLOT_MINUTES} min`,
    label: "Grid resolution",
    note: `${SLOTS_PER_HOUR} slots an hour, ${SLOTS_PER_DAY} a day`,
  },
  {
    value: "1 min",
    label: "Bar precision",
    note: "03:53 is drawn at 03:53, never rounded",
  },
  {
    value: String(HOURS_PER_DAY),
    label: "Hours per row",
    note: "the whole day, end to end",
  },
];

const FEATURES: { title: string; body: string; accent: string }[] = [
  {
    title: "A month you can read at a glance",
    body: "Every day of the chosen month is a row, every hour a column. Scroll down and the hour header stays put; scroll across and the day column stays put.",
    accent: "#5b7a9e",
  },
  {
    title: "Open a block to see inside it",
    body: "A long stretch of work is rarely one thing. Expand any bar and its parts appear on the same time axis, so you can see what you were doing at a particular moment within it.",
    accent: "#8a6fa8",
  },
  {
    title: "Honest about messy days",
    body: "Two things at once stack side by side instead of hiding each other. Work that runs past midnight is drawn on both days, cut at the boundary rather than pretending it stopped.",
    accent: "#7f9470",
  },
  {
    title: "Built for your thumb as well",
    body: "On a phone the timeline turns: hours run down the screen for a single day, and you swipe left or right to move between days.",
    accent: "#c99a4a",
  },
];

export function LandingPage() {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const isSignedIn = session?.authenticated === true;

  return (
    <div className="min-h-full">
      {/* ---------------------------------------------------------------- nav */}
      <header className="sticky top-0 z-40 border-b border-rule/70 bg-sand/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <span className="display text-lg text-ink">Productivity&nbsp;Tracker</span>
          {isSignedIn && (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/tracker">Open tracker</Link>
            </Button>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <h1 className="display text-[clamp(2.4rem,8.5vw,4rem)] text-ink">
              Every hour of your month,{" "}
              <span className="display-italic text-clay">measured</span>.
            </h1>

            <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-secondary sm:text-[17px]">
              A calm, Gantt-style timeline for your own time. Log what you did and when
              you actually did it, then open any block to see the smaller pieces inside.
            </p>

            <div className="mt-8">
              <SignInPanel />
            </div>
          </div>

          {/* The strip scrolls horizontally on small screens rather than being
              shrunk into illegibility. */}
          <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 lg:overflow-visible">
            <div className="w-fit">
              <HeroTimeline hourWidth={isMobile ? 104 : 128} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- facts */}
      <section className="border-y border-rule bg-card/60">
        <dl className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3 sm:px-8">
          {FACTS.map((fact) => (
            <div key={fact.label}>
              <dd className="display readout text-[2.6rem] leading-none text-clay">
                {fact.value}
              </dd>
              <dt className="mt-2 text-sm font-semibold text-ink">{fact.label}</dt>
              <dd className="mt-1 text-sm text-ink-muted">{fact.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="display max-w-[24ch] text-[clamp(1.8rem,4.6vw,2.75rem)] text-ink">
          Built for the resolution where the truth lives.
        </h2>

        <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className={
                // The first card spans both columns, so the grid has a focal
                // point instead of four identical tiles.
                index === 0
                  ? "rounded-3xl border border-rule bg-card p-6 shadow-lift-2 sm:col-span-2 sm:p-8"
                  : "rounded-3xl border border-rule bg-card p-6 shadow-lift-1 sm:p-7"
              }
            >
              <span
                className="mb-4 block h-1.5 w-12 rounded-full"
                style={{ backgroundColor: feature.accent }}
                aria-hidden="true"
              />
              <h3
                className={
                  index === 0
                    ? "display text-2xl text-ink sm:text-[28px]"
                    : "display text-xl text-ink"
                }
              >
                {feature.title}
              </h3>
              <p className="mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- closing */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="rounded-[2rem] border border-rule bg-card px-6 py-10 text-center shadow-lift-2 sm:px-12 sm:py-14">
          <h2 className="display mx-auto max-w-[26ch] text-[clamp(1.6rem,4.2vw,2.4rem)] text-ink">
            Your time, in your own account.
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-ink-secondary">
            Activities and categories belong to you alone. Nothing is shared and nothing
            is shown to anyone else.
          </p>
          {isSignedIn && (
            <Button variant="primary" size="lg" className="mt-7" asChild>
              <Link to="/tracker">
                Open the tracker
                <ArrowRightIcon />
              </Link>
            </Button>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <p className="border-t border-rule pt-6 text-sm text-ink-muted">
          A personal time instrument.
        </p>
      </footer>
    </div>
  );
}
