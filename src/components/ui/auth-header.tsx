import { Logo } from "./logo";

export function AuthHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="flex justify-center">
        <Logo width={150} />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-text">{title}</h1>
    </div>
  );
}
