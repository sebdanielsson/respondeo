export async function Footer() {
  return (
    <div className="relative flex flex-col">
      <footer className="border-t py-6 md:py-0">
        <div className="text-muted-foreground container mx-auto flex h-14 items-center justify-center text-sm">
          <span>
            View source code on{" "}
            <a
              href="https://github.com/sebdanielsson/quiz-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black dark:text-white"
            >
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
