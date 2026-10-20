// O app usa texto claro por padrão (globals.css); o CRM de vendas é tema claro, então fixa a cor escura.
export default function VendasLayout({ children }: { children: React.ReactNode }) {
  return <div className="text-slate-800">{children}</div>
}
