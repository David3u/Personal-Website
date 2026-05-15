import { siteContent } from "@/data/site-content";
import ScrollReveal from "./ScrollReveal";

export default function Experience() {
  const { title, jobs } = siteContent.experience;

  return (
    <section className="section">
      <div className="container-resume">
        <ScrollReveal>
          <h2 className="heading-section mb-12">{title}</h2>
        </ScrollReveal>

        <div className="timeline max-w-3xl">
          {jobs.map((job, index) => (
            <ScrollReveal key={`${job.company}-${job.period}`} delay={index * 100}>
              <div className="timeline-item">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-3">
                  <div>
                    <h3 className="heading-card text-[#fafafa]">{job.title}</h3>
                    <p className="text-body-sm mt-1">{job.company}</p>
                  </div>
                  <span className="text-caption shrink-0">{job.period}</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-body-sm">
                      <span className="mt-2 w-1 h-1 rounded-full bg-[#d0d0d0] shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
