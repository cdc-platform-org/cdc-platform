export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export default function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section, i) => (
        <section key={i}>
          <h2 className="text-lg font-black text-white mb-3">{section.heading}</h2>
          <div className="space-y-3">
            {section.paragraphs.map((p, j) => (
              <p key={j} className="text-sm text-slate-400 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
