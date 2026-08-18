import PagePlaceholder from "@/components/PagePlaceholder";

// Dashboard outline. This is the shell's landing view — replace the
// placeholder with real PQC platform content as sections are built.
export default function Home() {
  return (
    <div className="animate-fade-in-up">
      <PagePlaceholder
        title="Dashboard"
        description="Light Rider post-quantum cryptography platform."
      />
    </div>
  );
}
