import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { siteContent } from "@/data/site-content";
import ScrollReveal from "./ScrollReveal";

export default function Projects() {
  const { title, items: projects } = siteContent.projects;

  return (
    <section className="section">
      <div className="container-resume">
        <ScrollReveal>
          <h2 className="heading-section mb-12">{title}</h2>
        </ScrollReveal>

        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2">
          {projects.map((project, index) => (
            <ScrollReveal key={project.title} delay={index * 100}>
              <article className="project-item group flex h-full flex-col">
                <div className="relative w-full aspect-video mb-5 rounded-lg overflow-hidden bg-[#1a1a1d]">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <h3 className="heading-card mb-2 text-[#fafafa]">{project.title}</h3>

                <p className="text-body-sm mb-4 flex-grow">{project.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#a1a1aa] hover:text-[#f59e0b] transition-colors group/link"
                >
                  {project.linkText}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" />
                </a>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
