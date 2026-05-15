import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Education from "@/components/Education";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0b]">
      <div id="hero">
        <Hero />
      </div>

      <div id="experience">
        <Experience />
      </div>

      <div id="projects">
        <Projects />
      </div>

      <div id="education">
        <Education />
      </div>
    </main>
  );
}
