import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center">
      <div className="text-center max-w-md mx-4 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 mb-6">
          <AlertCircle className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">404</h1>
        <p className="text-lg text-slate-500 mb-8">
          This page could not be found.
        </p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
