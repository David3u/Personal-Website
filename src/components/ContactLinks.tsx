import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { HiOutlineEnvelope } from "react-icons/hi2";
import type { ContactLink } from "@/data/site-content";

type ContactLinksProps = {
  links: ContactLink[];
};

function getIcon(type: string) {
  switch (type) {
    case "email":
      return <HiOutlineEnvelope className="w-5 h-5" />;
    case "linkedin":
      return <FaLinkedin className="w-5 h-5" />;
    case "github":
      return <FaGithub className="w-5 h-5" />;
    default:
      return null;
  }
}

export default function ContactLinks({ links }: ContactLinksProps) {
  return (
    <div className="flex gap-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target={link.type !== "email" ? "_blank" : undefined}
          rel={link.type !== "email" ? "noopener noreferrer" : undefined}
          className="btn-social-icon"
          aria-label={link.label}
        >
          {getIcon(link.type)}
        </a>
      ))}
    </div>
  );
}
