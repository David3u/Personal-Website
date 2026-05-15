import { AcademicCapIcon, TrophyIcon } from "@heroicons/react/24/outline";
import ScrollReveal from "./ScrollReveal";
import { siteContent } from "@/data/site-content";

export default function Education() {
  const { title, education, certifications } = siteContent.education;

  return (
    <section className="section bg-[#111113]">
      <div className="container-resume">
        <ScrollReveal>
          <h2 className="heading-section mb-12">{title}</h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-12">
          <ScrollReveal delay={100}>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#1a1a1d] text-[#f59e0b]">
                  <AcademicCapIcon className="w-5 h-5" />
                </div>
                <h3 className="heading-card">Education</h3>
              </div>

              <div className="space-y-6">
                {education.map((item) => (
                  <div key={`${item.institution}-${item.year}`} className="group">
                    <h4 className="text-[#fafafa] font-medium mb-1">{item.degree}</h4>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-hover text-body-sm"
                      >
                        {item.institution}
                      </a>
                    ) : (
                      <p className="text-body-sm">{item.institution}</p>
                    )}
                    <p className="text-caption mt-1">{item.year}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#1a1a1d] text-[#f59e0b]">
                  <TrophyIcon className="w-5 h-5" />
                </div>
                <h3 className="heading-card">Certifications</h3>
              </div>

              <div className="space-y-6">
                {certifications.map((cert) => (
                  <div key={`${cert.issuer}-${cert.year}`} className="group">
                    <h4 className="text-[#fafafa] font-medium mb-1">{cert.name}</h4>
                    {cert.link ? (
                      <a
                        href={cert.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-hover text-body-sm"
                      >
                        {cert.issuer}
                      </a>
                    ) : (
                      <p className="text-body-sm">{cert.issuer}</p>
                    )}
                    <p className="text-caption mt-1">{cert.year}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
