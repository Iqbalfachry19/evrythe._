const images = [
  "/gallery/1.jpg",
  "/gallery/2.jpg",
  "/gallery/3.jpg",
  // Add more images to public/gallery/
];

export default function Gallery() {
  return (
    <section className="px-8 py-12">
      <h2 className="text-2xl font-bold mb-6 text-center">Gallery</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`evr!t post ${idx + 1}`}
            className="w-full h-auto rounded-md object-cover"
          />
        ))}
      </div>
    </section>
  );
}
