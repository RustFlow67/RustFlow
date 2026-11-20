import LiquidGlass from "@/components/LiquidGlass";
import { ArrowRight, Compass } from "lucide-react";
import Link from "@/components/RouteLink";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <LiquidGlass className="glass pop-in max-w-lg p-8 text-center sm:p-12">
        <span className="icon-tile mx-auto">
          <Compass aria-hidden="true" />
        </span>
        <p className="display mt-6 text-[5rem] text-glow">404</p>
        <h1 className="headline mt-2 text-2xl">Такой страницы нет</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          Возможно, твик переименован или ссылка устарела. Все твики собраны в каталоге.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/tweaker" className="btn btn-primary">
            Открыть каталог
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/" className="btn">
            На главную
          </Link>
        </div>
      </LiquidGlass>
    </div>
  );
}
