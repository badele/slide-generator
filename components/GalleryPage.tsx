import TemplateCard from '@/components/TemplateCard';
import type { TemplateInfo } from '@/lib/types';

export default function GalleryPage({ templates }: { templates: TemplateInfo[] }) {

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-semibold text-white">Slide Generator</span>
        <a
          href="/?template=post_top"
          className="px-3 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors"
        >
          Éditeur →
        </a>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-white">Templates</h1>
          <span className="text-sm text-gray-400">{templates.length} templates</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map(t => (
            <TemplateCard key={t.name} template={t} />
          ))}
        </div>

      </main>
    </div>
  );
}
