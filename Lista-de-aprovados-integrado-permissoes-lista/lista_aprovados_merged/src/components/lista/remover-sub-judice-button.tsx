"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

type Props = {
  candidatoId: string;
  nome: string;
};

export function RemoverSubJudiceButton({
  candidatoId,
  nome,
}: Props) {
  const router =
    useRouter();

  const [
    removendo,
    setRemovendo,
  ] = useState(false);

  async function remover() {
    const confirmou =
      window.confirm(
        `Remover o candidato Sub judice?\n\n${nome}\n\nA operação ficará registrada nos logs.`
      );

    if (!confirmou) {
      return;
    }

    setRemovendo(true);

    try {
      const supabase =
        createClient();

      const {
        error,
      } =
        await supabase.rpc(
          "remover_sub_judice",
          {
            p_candidato_id:
              candidatoId,
          }
        );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o candidato."
      );
    } finally {
      setRemovendo(
        false
      );
    }
  }

  return (
    <button
      type="button"
      disabled={
        removendo
      }
      onClick={
        remover
      }
      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {removendo
        ? "Removendo..."
        : "Remover Sub judice"}
    </button>
  );
}