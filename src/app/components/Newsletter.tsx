export default function Newsletter() {
  return (
    <section className="bg-gray-100 py-12 px-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Stay Updated</h2>
      <p className="mb-6">Subscribe for exclusive content from evr!t</p>
      <form
        action="https://formspree.io/f/your-id"
        method="POST"
        className="max-w-md mx-auto"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="Your email"
          className="w-full p-3 border rounded-md mb-3"
        />
        <button type="submit" className="bg-black text-white py-2 px-6 rounded">
          Subscribe
        </button>
      </form>
    </section>
  );
}
