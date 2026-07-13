"use client";

import {
  ArrowDownTrayIcon,
  BriefcaseIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { siteContent } from "@/data/site-content";
import AnimatedWu from "./AnimatedWu";
import ContactLinks from "./ContactLinks";
import ScrollReveal from "./ScrollReveal";

export default function Hero() {
  const { name, title, subtitle, resumeButtonText } = siteContent.hero;
  const { links } = siteContent.contact;
  const nameParts = name.trim().split(/\s+/);
  const suffix = nameParts[nameParts.length - 1] ?? "";
  const baseName = nameParts.slice(0, -1).join(" ");
  const shouldAnimateWu = suffix.toLowerCase() === "wu" && baseName.length > 0;
  const scrollToExperience = () => {
    const element = document.getElementById("experience");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToProjects = () => {
    const element = document.getElementById("projects");
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
                    <AnimatedWu />
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
                  <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
                  {resumeButtonText}
                </a>

                <button onClick={scrollToExperience} className="btn-secondary">
                  <BriefcaseIcon className="h-5 w-5" aria-hidden="true" />
                  View Experience
                </button>

                <button onClick={scrollToProjects} className="btn-secondary">
                  <FolderOpenIcon className="h-5 w-5" aria-hidden="true" />
                  View Projects
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
