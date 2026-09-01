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
