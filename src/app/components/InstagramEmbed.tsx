export default function InstagramEmbed() {
  return (
    <section className="text-center my-10">
      <h2 className="text-xl font-bold mb-4">Check Latest Post</h2>
      <iframe
        src="https://www.instagram.com/evrythe._/embed"
        width="320"
        height="440"
        frameBorder="0"
        scrolling="no"
        allowTransparency
        className="mx-auto"
      />
    </section>
  );
}
