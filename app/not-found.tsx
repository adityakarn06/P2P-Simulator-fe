import Link from "next/link";
import { Button } from "@/components/ui/button"; // Assuming Shadcn Button component

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl mb-8">Page Not Found</h2>
      <p className="text-lg text-muted-foreground mb-8">
        The page you are looking for does not exist.
      </p>
      <Link href="/">
        <Button className="cursor-pointer">Go back home</Button>
      </Link>
    </div>
  );
}
