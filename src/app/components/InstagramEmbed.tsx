export default function InstagramEmbed() {
  return (
    <section className="my-16 px-4 bg-white rounded-2xl py-2 shadow-lg max-w-3xl mx-auto">
      <h2 className="text-2xl font-extrabold mb-6 text-center text-gray-900">
        Check My Latest Instagram Post
      </h2>

      <div className="bg-gradient-to-tr from-pink-400 via-red-400 to-yellow-400 p-1 rounded-xl shadow-lg hover:scale-[1.02] transition-transform duration-300 ease-in-out">
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="relative w-full aspect-[9/12] sm:aspect-[4/5] min-h-[500px]">
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
        className="mt-6 block text-center text-pink-600 font-semibold hover:text-pink-800 transition"
      >
        Follow us on Instagram
      </a>
    </section>
  );
}
