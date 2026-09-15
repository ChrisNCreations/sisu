import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RiskMeter } from "@/components/risk-meter";

// Public front door. Static by design: no wallet, no SDK, no deployment.json.
// The app lives behind it at /dashboard, /strategy, /swap, /history.
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-void text-mist">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[6px] focus:bg-acid-lime focus:px-3 focus:py-2 focus:text-void"
      >
        Skip to content
      </a>

      <header className="flex h-12 items-center justify-between gap-3 border-b border-graphite px-3 md:px-6">
        <span className="flex items-center gap-2 px-1 text-[16px] font-[510] text-paper">
          <span
            aria-hidden
            className="grid size-4 place-items-center rounded-[2px] border border-paper/80"
          >
            <span className="size-1.5 bg-paper" />
          </span>
          Sisu
        </span>
        <Button variant="primary" size="md" asChild>
          <Link href="/dashboard">Launch App</Link>
        </Button>
      </header>

      {/* Centered hero: badge pills, headline, CTAs, then the product
          in a browser frame. Static dotted backdrop, no 3D scene. */}
      <section className="relative overflow-hidden">
        {/* Dot grid: faint fog dots fading out toward the edges. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(138,143,152,0.28) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage:
              "radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 75%)",
          }}
        />
        <div
          id="content"
          className="relative z-10 mx-auto flex w-full max-w-5xl scroll-mt-6 flex-col items-center px-4 pb-10 pt-12 text-center md:px-6 md:pb-14 md:pt-16"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge tone="lime">Aqua settlement</Badge>
            <Badge tone="lime">SwapVM policy</Badge>
            <Badge tone="lime">Onchain risk cap</Badge>
          </div>
          <h1 className="mt-6 max-w-3xl text-[40px] font-normal leading-[1.1] tracking-[-0.02em] text-paper md:text-[64px]">
            Ship a book. Cap the risk.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-[1.6] text-mist">
            One self-custodial 50/50 ETH/USDC book on Aqua + SwapVM.
            Liquidity stays in the maker wallet. Unsafe trades revert and no
            tokens move.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" size="md" asChild>
              <Link href="/dashboard">Launch App</Link>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <a href="#proof">Read the proof</a>
            </Button>
          </div>

          {/* Browser frame: the dashboard sells the product. */}
          <div className="relative mt-12 w-full">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 top-8 bottom-0 bg-acid-lime/[0.05] blur-[80px]"
            />
            <div className="relative overflow-hidden rounded-[12px] border border-graphite bg-carbon shadow-[var(--shadow-cta)]">
              <div className="flex items-center gap-3 border-b border-graphite px-4 py-2.5">
                <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-coral-red/80" />
                  <span className="size-2.5 rounded-full bg-[#e2a63d]/80" />
                  <span className="size-2.5 rounded-full bg-pulse-green/80" />
                </span>
                <span className="mx-auto hidden rounded-[6px] bg-white/[0.04] px-3 py-1 font-mono text-[12px] tabular text-fog sm:block">
                  sisu — /dashboard
                </span>
                <span className="w-[52px] shrink-0" aria-hidden />
              </div>
              <Image
                src="/hero-dashboard.png"
                alt="Sisu dashboard showing the seeded ETH/USDC book"
                width={1280}
                height={720}
                priority
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-6 md:py-14">

        <section className="grid gap-px overflow-hidden rounded-[12px] bg-graphite md:grid-cols-2">
          <div className="flex flex-col gap-2 bg-carbon px-4 py-4">
            <p className="text-[12px] text-fog">Maker</p>
            <p className="text-[14px] leading-[1.6] text-paper">
              Ships one 50/50 strategy. Earns more from flow that worsens
              inventory, less from flow that repairs it — capped so the book
              can never drain past max risk.
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-carbon px-4 py-4">
            <p className="text-[12px] text-fog">Trader</p>
            <p className="text-[14px] leading-[1.6] text-paper">
              Swaps against one visible book with an enforceable risk limit
              instead of opaque slippage. Unsafe swaps stay clickable and
              revert with the reason on screen.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[24px] font-normal tracking-[-0.012em] text-paper">
            Why Aqua + SwapVM
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col gap-2">
              <p className="text-[13px] font-[510] text-paper">Self-custody</p>
              <p className="text-[13px] leading-[1.6] text-fog">
                Tokens stay in the maker wallet. Aqua tracks virtual balances
                and pulls only what a settled swap needs.
              </p>
            </Card>
            <Card className="flex flex-col gap-2">
              <p className="text-[13px] font-[510] text-paper">
                Programmable policy
              </p>
              <p className="text-[13px] leading-[1.6] text-fog">
                Every swap runs one immutable program:{" "}
                <span className="font-mono tabular text-mist">
                  SISU_FEE → XYC → SISU_LIMIT
                </span>
                . Fee, price, then the risk gate.
              </p>
            </Card>
            <Card className="flex flex-col gap-2">
              <p className="text-[13px] font-[510] text-paper">
                UI estimates, VM enforces
              </p>
              <p className="text-[13px] leading-[1.6] text-fog">
                The frontend quotes via eth_call. SwapVM decides. The limit
                cannot be bypassed from the UI.
              </p>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Card className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] text-fog">Seeded book risk</h2>
              <Badge>Demo values</Badge>
            </div>
            <RiskMeter currentBps={120000000} maxBps={600000000} />
            <p className="text-[12px] leading-[1.6] text-fog">
              1 ETH + 3000 USDC @ $3000, maxRisk 60%. Safe swaps raise risk
              and settle. A 5 ETH swap projects past the limit and reverts.
            </p>
          </Card>
          <Card className="flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-fog">How a swap behaves</p>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-[1.6] text-mist">
                <li>Safe 0.05 ETH → ~142 USDC settles, risk rises.</li>
                <li>Unsafe 5 ETH stays clickable, reverts, nothing moves.</li>
                <li>Repair USDC → ETH settles, risk falls, fee is lower.</li>
              </ol>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="md" asChild>
                <Link href="/swap">Try the swap</Link>
              </Button>
              <Button variant="ghost" size="md" asChild>
                <Link href="/dashboard">See the book</Link>
              </Button>
            </div>
          </Card>
        </section>

        <section id="proof" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="text-[24px] font-normal tracking-[-0.012em] text-paper">
            On-chain proof
          </h2>
          <Card className="flex flex-col gap-3">
            <p className="font-mono text-[12px] tabular text-fog">
              safe quote: in=0.05 ETH out=142.448921274467781111 USDC
            </p>
            <p className="font-mono text-[12px] tabular text-fog">
              unsafe reverts: SisuRiskLimitExceeded(946525974, 600000000)
            </p>
            <p className="text-[13px] leading-[1.6] text-fog">
              Sepolia contracts are verified: Aqua{" "}
              <span className="font-mono tabular text-mist">
                0x3C79…011D22f
              </span>
              , Strategy{" "}
              <span className="font-mono tabular text-mist">
                0xCFDE…E8bC9
              </span>
              , Router{" "}
              <span className="font-mono tabular text-mist">
                0xD2e8…13d2
              </span>
              . Full table lives in DEPLOYMENT_INFO.md.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="md" asChild>
                <Link href="/dashboard">Launch App</Link>
              </Button>
              <Button variant="ghost" size="md" asChild>
                <Link href="/history">See history</Link>
              </Button>
            </div>
          </Card>
        </section>

        <footer className="border-t border-graphite py-8 text-[12px] text-fog">
          <div className="grid gap-8 border-b border-graphite py-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[16px] font-[510] text-paper">
                <span aria-hidden className="text-[14px] text-acid-lime">
                  ★
                </span>
                <span>SISU</span>
              </div>
              <p className="max-w-[280px] leading-[1.8] text-fog">
                Self-custodial risk-bounded ETH/USDC book on Aqua + SwapVM.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <p className="text-[12px] font-[510] uppercase tracking-[0.12em] text-fog">
                Product
              </p>
              <ul className="flex flex-col gap-2 text-[13px]">
                <li><Link href="/dashboard" className="hover:text-paper">Launch app</Link></li>
                <li><a href="#proof" className="hover:text-paper">Proof</a></li>
                <li><a href="#" className="hover:text-paper">Security</a></li>
                <li><a href="#" className="hover:text-paper">What is real</a></li>
                <li><a href="#" className="hover:text-paper">Get started</a></li>
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <p className="text-[12px] font-[510] uppercase tracking-[0.12em] text-fog">
                Build
              </p>
              <ul className="flex flex-col gap-2 text-[13px]">
                <li><a href="#" className="hover:text-paper">GitHub</a></li>
                <li><a href="#" className="hover:text-paper">Contract</a></li>
                <li><a href="#" className="hover:text-paper">Claim ledger</a></li>
                <li><a href="#" className="hover:text-paper">Architecture</a></li>
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <p className="text-[12px] font-[510] uppercase tracking-[0.12em] text-fog">
                Network
              </p>
              <ul className="flex flex-col gap-2 text-[13px]">
                <li><a href="#" className="hover:text-paper">Sepolia</a></li>
                <li><a href="#" className="hover:text-paper">Aqua + SwapVM</a></li>
                <li><a href="#" className="hover:text-paper">Chain 11155111</a></li>
              </ul>
            </section>
          </div>

          <div className="pt-6 text-[12px] leading-[1.8] text-fog">
            SISU ships a 50/50 ETH/USDC strategy on Aqua + SwapVM. The UI
            estimates. SwapVM enforces. Risk caps and fees are checked on-chain.
          </div>
        </footer>
      </main>
    </div>
  );
}
