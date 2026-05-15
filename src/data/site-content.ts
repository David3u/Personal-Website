import content from "./content.json";

export const siteContent = content;

export type SiteContent = typeof siteContent;
export type ContactLink = SiteContent["contact"]["links"][number];
export type EducationItem = SiteContent["education"]["education"][number];
export type Certification = SiteContent["education"]["certifications"][number];
export type Job = SiteContent["experience"]["jobs"][number];
export type Project = SiteContent["projects"]["items"][number];
