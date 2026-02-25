import { FaInstagram, FaEnvelope } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-indigo-950 px-6 py-10 text-white">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <div>
          <h3 className="text-xl font-semibold tracking-wider">evr!t</h3>
          <p className="mt-1 text-sm text-indigo-200">
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>

        <div className="flex gap-6 text-lg">
          <a
            href="https://www.instagram.com/evrythe._/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-indigo-300"
          >
            <FaInstagram />
          </a>
          <a
            href="mailto:evrythe@gmail.com"
            className="transition hover:text-indigo-300"
          >
            <FaEnvelope />
          </a>
        </div>
      </div>
    </footer>
  );
}
