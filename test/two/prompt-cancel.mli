(* Module Hold — compile hold.mli first. Implementation: open Hold *)
(** Shared die. Both cavities compile against this. *)

type hold_id = string
type iso8601 = string
type actor = string

type stamp = {
  at : iso8601;
  actor : actor;
  note : string;
}

(* Module Cancel — this is the .mli you implement as cancel.ml *)
type cancel_cmd = {
  hold_id : Hold.hold_id;
  stamp : Hold.stamp;
  reason : string;
}

type cancel_error =
  | Hold_not_found of Hold.hold_id
  | Hold_cancelled of Hold.hold_id
  | Hold_already_confirmed of string
  | Actor_unauthorized of string
  | Malformed of string

val cancel : cancel_cmd -> (unit, cancel_error) result
