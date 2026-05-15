"use client";

import { useEffect, useState } from "react";
import { siteContent } from "@/data/site-content";
import ContactLinks from "./ContactLinks";
import ScrollReveal from "./ScrollReveal";

const LEFT_VARIANTS = ["W", "Uu", "3"] as const;
type LeftVariant = (typeof LEFT_VARIANTS)[number];
const LEFT_WIDTH_CH: Record<LeftVariant, string> = {
  W: "1.35ch",
  Uu: "1.88ch",
  3: "0.90ch",
};
const HOLD_BY_LEFT_MS: Record<LeftVariant, number> = {
  W: 3600,
  Uu: 600,
  3: 2000,
};
const RIGHT_SUFFIX = "u";
const TRANSITION_DURATION_MS = 700;

export default function Hero() {
  const { name, title, subtitle, resumeButtonText } = siteContent.hero;
  const { links } = siteContent.contact;
  const [activeIndex, setActiveIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nameParts = name.trim().split(/\s+/);
  const suffix = nameParts[nameParts.length - 1] ?? "";
  const baseName = nameParts.slice(0, -1).join(" ");
  const shouldAnimateWu = suffix.toLowerCase() === "wu" && baseName.length > 0;
  const activeLeft = LEFT_VARIANTS[activeIndex];
  const incomingLeft = incomingIndex !== null ? LEFT_VARIANTS[incomingIndex] : null;
  const targetLeft = isTransitioning && incomingLeft ? incomingLeft : activeLeft;

  useEffect(() => {
    if (!shouldAnimateWu) {
      setActiveIndex(0);
      setIncomingIndex(null);
      setIsTransitioning(false);
      return;
    }

    const holdTimer = window.setTimeout(() => {
      setIncomingIndex((activeIndex + 1) % LEFT_VARIANTS.length);
      setIsTransitioning(true);
    }, HOLD_BY_LEFT_MS[activeLeft]);

    return () => window.clearTimeout(holdTimer);
  }, [activeIndex, activeLeft, shouldAnimateWu]);

  useEffect(() => {
    if (!shouldAnimateWu || !isTransitioning || incomingIndex === null) {
      return;
    }

    const transitionTimer = window.setTimeout(() => {
      setActiveIndex(incomingIndex);
      setIncomingIndex(null);
      setIsTransitioning(false);
    }, TRANSITION_DURATION_MS);

    return () => window.clearTimeout(transitionTimer);
  }, [incomingIndex, isTransitioning, shouldAnimateWu]);

  const scrollToExperience = () => {
    const element = document.getElementById("experience");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="min-h-[100vh] flex items-center">
      <div className="container-resume">
        <div className="max-w-4xl">
          <ScrollReveal>
            <p className="text-caption mb-4 text-[#f59e0b]">{title}</p>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="font-display text-[clamp(4rem,16vw,8rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#fafafa] mb-6">
              {shouldAnimateWu ? (
                <>
                  <span className="sr-only">{name}</span>
                  <span aria-hidden="true">
                    {baseName}{" "}
                    <span className="wu-name">
                      <span
                        className="wu-left-shell"
                        style={{ width: LEFT_WIDTH_CH[targetLeft] }}
                      >
                        <span className="wu-left-anchor">{targetLeft}</span>
                        <span
                          className={`wu-left-item ${
                            isTransitioning ? "wu-morph-out" : "wu-morph-steady"
                          }`}
                        >
                          {activeLeft}
                        </span>
                        {incomingLeft !== null && (
                          <span className="wu-left-item wu-morph-in">{incomingLeft}</span>
                        )}
                      </span>
                      <span className="wu-right-static">{RIGHT_SUFFIX}</span>
                    </span>
                  </span>
                </>
              ) : (
                name
              )}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="text-body text-lg mb-10 max-w-[37rem] leading-relaxed">
              {subtitle}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="flex flex-col items-start gap-4">
              <div className="flex flex-wrap gap-4">
                <a
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  {resumeButtonText}
                </a>

                <button onClick={scrollToExperience} className="btn-secondary">
                  View Experience
                </button>
              </div>

              <ContactLinks links={links} />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
