package com.kasrat.alerts

/**
 * Notification text for the background alert check.
 *
 * Word-for-word copies of `functions/src/copy.ts` and `functions/src/pokeCopy.ts`
 * — the same moments the server would have pushed, in the same voice. A
 * nudge's own message is never shown here: the text is built from its kind and
 * the sender's public name, so nobody can put words on someone's lock screen.
 */
object AlertCopy {
  /** Same stable seed as `seedFrom` in pokeCopy.ts, so the phone and server pick the same line. */
  fun seedFrom(id: String): Int {
    var h = 0
    id.forEach { h = h * 31 + it.code }
    return h
  }

  private fun <T> pick(options: List<T>, seed: Int): T = options[(Math.abs(seed.toLong()) % options.size).toInt()]

  fun poke(kind: String, sender: String, id: String): Pair<String, String> {
    val name = sender.trim().ifEmpty { "A friend" }
    val seed = seedFrom(id)
    return when (kind) {
      "challenge" ->
        "$name challenged you" to
          pick(
            listOf(
              "Head to head, starting whenever you are.",
              "They fancy their chances. Prove otherwise.",
              "A friendly one — but it's on.",
            ),
            seed,
          )
      "cheer" ->
        "$name cheered you on" to
          pick(
            listOf(
              "They saw your session and were impressed.",
              "That one counted, apparently.",
              "Someone noticed the work.",
            ),
            seed,
          )
      else ->
        "$name nudged you" to
          pick(
            listOf(
              "No pressure — just a wave.",
              "The door is open whenever you fancy it.",
              "They reckon today looks like a good day for it.",
            ),
            seed,
          )
    }
  }

  fun passed(passer: String, club: String, savage: Boolean): Pair<String, String> =
    if (savage) {
      "$passer took your spot" to
        "$passer just ran past you on $club. If I were you, I'd challenge them and take it back today."
    } else {
      "Overtaken" to "$passer passed you on the $club board. One run gets it back."
    }

  fun steal(thief: String, yourClub: String, blocks: Int, savage: Boolean): Pair<String, String> {
    val n = if (blocks == 1) "a block" else "$blocks blocks"
    return if (savage) {
      "$thief is in your streets" to
        "$thief just took $n off $yourClub. If I were you, I'd lace up and take them back tonight."
    } else {
      "$thief took $n" to "$thief took $n from $yourClub. Run through them this week to win them back."
    }
  }
}
