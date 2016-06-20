
a; return x; b;
  --> error: b is dead code.



while x < 3 do {
  a := a + 1
  if a > 5 then return false
}

if x < 3 then {
  let ?x = repeat {
    a := a + 1
    if a > 5 then break (?return = false)
    if not (x < 3) then break
  }
  ?x match {
    (?return) -> return ?return
  }
}
