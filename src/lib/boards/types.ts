export type Portal = "greenhouse" | "lever" | "ashby" | "breezy";

export type Board = { id: number; portal: Portal; identifier: string; displayName: string };

export type CheckStatus = "active" | "empty" | "not_found" | "dead";

export type BoardCheck = {
  boardId: number;
  status: CheckStatus;
  jobCount: number | null;
  checkedAt: string;
};
