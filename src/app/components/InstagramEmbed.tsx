export default function InstagramEmbed() {
  return (
    <section className="mx-auto my-12 sm:my-16 max-w-4xl rounded-[24px] sm:rounded-[30px] border border-indigo-900 bg-indigo-50 px-4 py-6 sm:px-5 shadow-[6px_6px_0_0_rgba(30,27,75,0.92)] sm:shadow-[8px_8px_0_0_rgba(30,27,75,0.92)]">
      <p className="text-center text-xs font-bold tracking-[0.35em] text-indigo-700">
        AUTHOR FEED
      </p>
      <h2 className="mb-6 mt-2 text-center text-2xl font-bold text-indigo-950">
        Style Snapshot From @evrythe._
      </h2>

      <div className="rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-500 to-indigo-300 p-[6px] shadow-lg transition-transform duration-300 ease-in-out hover:scale-[1.01]">
        <div className="overflow-hidden rounded-xl bg-white">
          <div className="relative w-full aspect-[9/12] sm:aspect-[4/5] min-h-[400px] sm:min-h-[500px]">
            <iframe
              src="https://www.instagram.com/evrythe._/embed"
              className="absolute top-0 left-0 w-full h-full border-0"
              allow="encrypted-media"
              title="Instagram Post Embed"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <a
        href="https://www.instagram.com/evrythe._/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block text-center font-semibold text-indigo-700 transition hover:text-indigo-950"
      >
        Explore full profile
      </a>
    </section>
  );
}
