import {
  CARD_LABELS,
  DEFAULT_LOCALE,
  PHASE_LABELS,
  SUPPORTED_LOCALES,
  getCardLabel,
  getPhaseLabel,
} from "./game/constants.js";

const MESSAGES = {
  en: {
    "metric.trust": "Trust",
    "ui.choice.rest": "Rest",
    "ui.choice.attack": "Attack",
    "ui.choice.ok": "OK",
    "ui.roundReport.lastRound": "Last round",
    "ui.roundReport.alerts": "Alerts",
    "ui.roundReport.enemyNoEffect": "The enemy did not cause an effect worth reporting.",
    "ui.roundReport.selfNoEffect": "Your move did not cause an effect worth reporting.",
    "ui.roundReport.enemyNotResolved":
      "The enemy did not resolve their strategy because the match ended first.",
    "ui.roundReport.selfNotResolved":
      "Your strategy did not resolve because the match ended first.",
    "ui.stage.openAttackView": "Open attack view",
    "ui.stage.openRestView": "Open rest view",
    "ui.stage.swapAttackRest": "Switch between attack and rest",
    "ui.stage.waiting": "Waiting...",
    "ui.header.backToServers": "Back to servers",
    "ui.header.nextTurn": "Next turn",
    "ui.overlay.winnerHint": "tap or press any key",
    "ui.overlay.winnerTitleAlt": "Winner",
    "ui.report.gameOver": "End of Match",
    "ui.report.turns": "Turns",
    "ui.report.winner": "Winner",
    "ui.report.type": "Type",
    "ui.report.playAgain": "Another match",
    "ui.report.viewBoard": "View board",
    "ui.report.noWinner": "Nobody",
    "ui.surrender.closeConfirm": "Close surrender confirmation",
    "ui.surrender.confirmTitle": "Surrender the match?",
    "ui.surrender.confirmBody":
      "You will leave this room and return to the server list.",
    "ui.surrender.cancel": "Cancel",
    "ui.surrender.confirm": "Surrender",
    "ui.surrender.button": "Surrender",
    "ui.surrender.round": ({ round }) => `Round ${round}`,
    "ui.lobby.noPlayers": "No players in this room yet.",
    "ui.lobby.roomTitle": ({ room }) => `Room ${room}`,
    "ui.lobby.syncing": "Syncing with the room server.",
    "ui.lobby.waitingPlayers": "Waiting for two active players in the room.",
    "ui.lobby.backToMenu": "Back to local menu",
    "ui.blocked.noConfirmed": "No confirmed player in this room.",
    "ui.blocked.fullTitle": "Room full",
    "ui.blocked.notJoinedTitle": "You did not join this match",
    "ui.blocked.fullCopy":
      "This room already has two players. Use another room or restart the current match.",
    "ui.blocked.notJoinedCopy":
      "Your browser synced the room, but this user did not become one of the two active players.",
    "ui.blocked.tip": "Tip: try a new room with two different users.",
    "ui.menu.userTitle": "User.",
    "ui.menu.kicker": "vibinet room play",
    "ui.menu.userLabel": "User",
    "ui.menu.userPlaceholder": "e.g. Zorro",
    "ui.menu.viewServers": "View servers",
    "ui.serverList.kicker": "fixed list",
    "ui.serverList.title": "Servers.",
    "ui.serverList.connect": "Connect",
    "ui.serverList.back": "Back",
    "ui.notices.fillUserAndServer": "Fill in the user and select a server.",
    "ui.notices.fillUser": "Fill in the user.",
    "ui.notices.selectServer": "Select a server.",
    "ui.notices.matchReturnedToMenu": "The match returned to the shared menu.",
    "ui.warning.king.limitCookFalls":
      "The King is at the limit. Nobody rests. The Cook falls now.",
    "ui.warning.king.limitSelfFalls":
      "The King is at the limit. Nobody rests. He may fall now.",
    "ui.warning.king.limitCookNext":
      "The King is at the limit. Nobody rests. The Cook falls next.",
    "ui.warning.king.limitSelfNext":
      "The King is at the limit. Nobody rests. He falls next.",
    "ui.warning.king.tired":
      "The King is very tired. If he does not rest, nobody rests.",
    "ui.warning.public.king.tired": ({ player }) =>
      `${player}'s King is very tired. If he does not rest, nobody rests.`,
    "ui.warning.cook.limitKingFalls":
      "The Cook is at the limit. Betrayal already passes. The King may fall.",
    "ui.warning.cook.limitOnly": "The Cook is at the limit.",
    "ui.warning.cook.limitKingNext":
      "The Cook is at the limit. Betrayal passes. If he does not rest, the King falls.",
    "ui.warning.cook.tiredCollapse":
      "The Cook is very tired. If he does not rest, he may collapse.",
    "ui.warning.cook.tiredBetrayl":
      "The Cook is very tired. If he does not rest, Betrayal passes.",
    "ui.warning.guard.exhausted": "The Guard is exhausted. Invader already passes.",
    "ui.warning.guard.tiredPasses":
      "The Guard is very tired. Invader deals 3->4 damage now. At 5, it passes.",
    "ui.warning.guard.tiredDamage":
      "The Guard is very tired. Invader deals 2->3 damage now.",
    "net.server.name": ({ number }) => `Room ${number}`,
    "net.probe.unavailable.text": ({ server }) => `Server ${server} unavailable.`,
    "net.probe.unavailable.detail":
      "The initial connection could not even open the network client.",
    "net.probe.online.text": ({ server }) => `Server ${server} online.`,
    "net.probe.online.detail":
      "The configured server answered the initial sync.",
    "net.probe.checking.text": ({ server }) => `Checking ${server}...`,
    "net.probe.checking.detail":
      "The start screen is still waiting for the first sync response.",
    "net.probe.openWaiting.text": "Connection open, waiting for initial sync...",
    "net.probe.openWaiting.detail":
      "The websocket opened, but the server has not answered on_sync yet.",
    "net.probe.reconnecting.text": ({ server }) => `Server ${server} reconnecting.`,
    "net.probe.reconnecting.detail":
      "The connection dropped or did not answer. The client is trying to reconnect.",
    "net.probe.offline.text": ({ server }) =>
      `Server ${server} offline or not responding.`,
    "net.probe.offline.detail":
      "If the join button does nothing, the problem is probably the configured endpoint.",
    "net.directory.unavailable": "unavailable",
    "net.directory.noResponse": "no response",
    "net.directory.checking": "checking",
    "net.directory.syncing": "syncing",
    "net.directory.people.one": "1 person",
    "net.directory.people.many": ({ count }) => `${count} people`,
    "net.session.connecting": "Connecting to server...",
    "net.session.targetRoom": ({ room }) => `Target room: ${room}`,
    "net.session.server": ({ server }) => `Server: ${server}`,
    "net.session.waitingSync": "Still waiting for initial sync.",
    "net.session.syncTimeoutDetail":
      "If this does not leave this screen, the configured endpoint did not answer on_sync.",
    "engine.state.waitingPlayers": "Waiting for two players to join the room.",
    "engine.state.matchStarted": ({ matchNumber }) =>
      `Match ${matchNumber} started. Preparing turn 1.`,
    "engine.title.yourRest": "Your rest",
    "engine.title.spySent": "You sent Spy",
    "engine.title.spyReport": "Spy report",
    "engine.title.spyCaptured": "Spy captured",
    "engine.title.kingFury": "King fury",
    "engine.title.kingMadness": "King madness",
    "engine.title.cookCollapse": "Cook collapse",
    "engine.log.turnStarted": ({ turnNumber }) => `Turn ${turnNumber} started.`,
    "engine.log.selectionOpened": "Simultaneous selection opened.",
    "engine.log.resultsReady": "Turn results are ready.",
    "engine.log.turnEndedWithVictory": "The turn ended with a victory.",
    "engine.log.exhaustionUpdated": "Exhaustion counters updated.",
    "engine.log.userJoinedRoom": ({ user }) => `${user} joined the room.`,
    "engine.log.userLeftRoom": ({ user }) => `${user} left the room.`,
    "engine.log.waitingAnotherPlayer":
      "Waiting for another player to complete the room.",
    "engine.log.roomEmpty": "The room became empty.",
    "engine.log.lockedCastle": ({ seat }) => `${seat} locked a castle card.`,
    "engine.log.lockedStrategy": ({ seat }) => `${seat} locked a strategy card.`,
    "engine.log.clearedCastle": ({ seat }) => `${seat} cleared the castle card.`,
    "engine.log.clearedStrategy": ({ seat }) =>
      `${seat} cleared the strategy card.`,
    "engine.log.confirmedChoices": ({ seat }) => `${seat} confirmed their choices.`,
    "engine.log.openedNextTurn": ({ user }) => `${user} opened the next turn.`,
    "engine.log.closedMatchToMenu": ({ user }) =>
      `${user} ended the match and returned to the menu.`,
    "engine.log.restartedMatch": ({ user, matchNumber }) =>
      `${user} restarted the room for match ${matchNumber}.`,
    "engine.log.assassinLost": ({ attacker, defender }) =>
      `${attacker} lost the Assassin. ${defender}'s King was exposed.`,
    "engine.log.spyLostNobodyRested": ({ attacker }) =>
      `${attacker} lost the Spy because nobody rested.`,
    "engine.log.spyFoundRest": ({ attacker, card }, { card: cardLabel }) =>
      `${attacker} used Spy and found ${cardLabel(card)} resting.`,
    "engine.log.invaderDroppedGuard": ({ attacker, defender }) =>
      `${attacker} brought down ${defender}'s Guard.`,
    "engine.log.guardFellFromDamage": ({ defender }) =>
      `${defender}'s Guard fell from damage.`,
    "engine.log.tributeRaisedTrust": ({ attacker, defender }) =>
      `${attacker} sent Tribute. ${defender}'s trust went up.`,
    "engine.log.betraylLoweredTrust": ({ attacker, defender }) =>
      `${attacker} lowered ${defender}'s trust with Betrayal.`,
    "engine.log.kingMadnessReset": ({ player }) =>
      `${player} let the King reach 5 stacks. The Cook died and the King's exhaustion reset.`,
    "engine.log.kingMadnessLoss": ({ player, enemy }) =>
      `${player} let the King go mad on the next 5th stack. ${enemy} won immediately.`,
    "engine.rest.dummyText": "You chose Dummy. Nobody rested this turn.",
    "engine.rest.withCard": ({ card }, { card: cardLabel }) =>
      `You rested with ${cardLabel(card)}.`,
    "engine.report.default.selfVictoryBeforeResolve":
      "Your strategy did not resolve because the match ended first.",
    "engine.report.default.selfNoEffect":
      "Your move did not cause an effect worth reporting.",
    "engine.report.default.enemyVictoryBeforeResolve":
      "The enemy did not resolve their strategy because the match ended first.",
    "engine.report.default.enemyNoEffect":
      "The enemy did not cause an effect worth reporting.",
    "engine.assassin.public.selfKill": "You sent Assassin and killed the enemy King.",
    "engine.assassin.public.selfCaught": "You sent Assassin, but he was caught.",
    "engine.assassin.public.enemyKill":
      "The enemy sent Assassin and your King died while resting.",
    "engine.assassin.public.enemyCaught":
      "The enemy sent Assassin, but he was caught.",
    "engine.assassin.report.selfKill":
      "You sent Assassin and killed the enemy King while he was resting.",
    "engine.assassin.report.selfCaught":
      "You sent Assassin, but he was executed before reaching the King.",
    "engine.assassin.report.enemyKill":
      "The enemy sent Assassin and killed your King while he was resting.",
    "engine.assassin.report.enemyCaught":
      "The enemy sent Assassin, but he was executed before reaching your King.",
    "engine.winner.assassinatedKing": ({ attacker, defender }) =>
      `${attacker} assassinated ${defender}'s King.`,
    "engine.spy.sentText": "Your agent tried to discover who rested on the other side.",
    "engine.spy.report.selfCaught": "You sent Spy, but he fell into Dummy and was captured.",
    "engine.spy.report.enemyCaught":
      "The enemy sent Spy, but he fell into your Dummy and was captured.",
    "engine.spy.public.selfCaught":
      "You sent a Spy, but he was caught because nobody rested.",
    "engine.spy.public.enemyCaught":
      "The enemy sent a Spy, but nobody rested and he was caught.",
    "engine.spy.private.caught": "Your Spy was caught because nobody rested this turn.",
    "engine.spy.report.selfFound": ({ card }, { card: cardLabel }) =>
      `You sent Spy and discovered that the enemy rested with ${cardLabel(card)}.`,
    "engine.spy.report.enemyFound": ({ card }, { card: cardLabel }) =>
      `The enemy sent Spy and discovered that you rested with ${cardLabel(card)}.`,
    "engine.spy.private.found": ({ card }, { card: cardLabel }) =>
      `Your Spy discovered that the enemy rested with ${cardLabel(card)}.`,
    "engine.invader.public.selfSleepingGuard":
      "You sent Invader and the enemy Guard was resting.",
    "engine.invader.public.enemySleepingGuard":
      "The enemy sent Invader and your Guard was resting.",
    "engine.invader.public.selfExhaustedGuard":
      "You sent Invader and the enemy Guard was too exhausted to block. The King was captured.",
    "engine.invader.public.enemyExhaustedGuard":
      "The enemy sent Invader and your Guard was too exhausted to block. The King was captured.",
    "engine.invader.public.selfGuardDefended": ({ before, after }) =>
      `You sent Invader and the enemy Guard defended. The Guard went from ${before} to ${after} damage.`,
    "engine.invader.public.enemyGuardDefended": ({ before, after }) =>
      `The enemy sent Invader and your Guard defended. The Guard went from ${before} to ${after} damage.`,
    "engine.invader.public.selfUnavailableGuard":
      "You sent Invader and the enemy Guard was unavailable. The King was captured.",
    "engine.invader.public.enemyUnavailableGuard":
      "The enemy sent Invader and your Guard was unavailable. The King was captured.",
    "engine.invader.report.selfKilledRestingGuard":
      "You sent Invader and found the enemy Guard resting. The Guard died.",
    "engine.invader.report.enemyKilledRestingGuard":
      "The enemy sent Invader and found your Guard resting. The Guard died.",
    "engine.invader.report.selfDefended": (
      { before, after, deathSuffix },
      { message },
    ) =>
      `You sent Invader. The enemy Guard defended and went from ${before} to ${after} damage.${message(deathSuffix)}`,
    "engine.invader.report.enemyDefended": (
      { before, after, deathSuffix },
      { message },
    ) =>
      `The enemy sent Invader. Your Guard defended and went from ${before} to ${after} damage.${message(deathSuffix)}`,
    "engine.invader.deathSuffix": " The Guard died from this damage.",
    "engine.invader.report.selfCapturedExhausted":
      "You sent Invader, but the enemy Guard was too exhausted to block. The King was captured.",
    "engine.invader.report.selfCapturedDead":
      "You sent Invader while the enemy Guard was already dead. The King was captured.",
    "engine.invader.report.enemyCapturedExhausted":
      "The enemy sent Invader, but your Guard was too exhausted to block. The King was captured.",
    "engine.invader.report.enemyCapturedDead":
      "The enemy sent Invader while your Guard was already dead. The King was captured.",
    "engine.winner.captureKing": ({ attacker, defender }) =>
      `${attacker} captured ${defender}'s King.`,
    "engine.winner.cookCollapse": ({ player, enemy }) =>
      `${player} let the Cook reach 5 stacks. ${enemy} won immediately.`,
    "engine.tribute.report.selfGain": ({ before, after }) =>
      `You sent Tribute and gained 1 trust with the enemy (${before} -> ${after}).`,
    "engine.tribute.report.selfMax": ({ value }) =>
      `You sent Tribute and kept the enemy trust at the maximum (${value}).`,
    "engine.tribute.report.enemyGain": ({ before, after }) =>
      `The enemy sent Tribute and gained 1 trust with you (${before} -> ${after}).`,
    "engine.tribute.report.enemyMax": ({ value }) =>
      `The enemy sent Tribute, but your trust in them was already at the maximum (${value}).`,
    "engine.tribute.public.sent": ({ before, after }) =>
      `You sent Tribute. The enemy trust went from ${before} to ${after}.`,
    "engine.tribute.public.received": ({ before, after }) =>
      `You received Tribute. Your trust went from ${before} to ${after}.`,
    "engine.betrayl.report.selfKill":
      "You sent Betrayal and caught the enemy Cook resting. The King was poisoned.",
    "engine.betrayl.report.enemyKill":
      "The enemy sent Betrayal and caught your Cook resting. The King was poisoned.",
    "engine.betrayl.public.selfKill":
      "You sent Betrayal while the enemy Cook was resting. The King was poisoned.",
    "engine.betrayl.public.enemyKill":
      "The enemy sent Betrayal while your Cook was resting. The King was poisoned.",
    "engine.betrayl.report.selfExposedKill":
      "You sent Betrayal and found the enemy King exposed. The King was poisoned.",
    "engine.betrayl.report.enemyExposedKill":
      "The enemy sent Betrayal and found your King exposed. The King was poisoned.",
    "engine.betrayl.public.selfExposedKill":
      "You sent Betrayal while the enemy King was exposed. The King was poisoned.",
    "engine.betrayl.public.enemyExposedKill":
      "The enemy sent Betrayal while your King was exposed. The King was poisoned.",
    "engine.winner.betrayl": ({ attacker, defender }) =>
      `${attacker} won with Betrayal over ${defender}.`,
    "engine.betrayl.reason.selfCookTooTired":
      "your Cook was too tired to protect the King",
    "engine.betrayl.reason.enemyCookDead": "the enemy Cook was already dead",
    "engine.betrayl.reason.enemyCookNotResting":
      "the enemy Cook was not resting",
    "engine.betrayl.reason.defendCookTooTired":
      "your Cook was too tired to protect the King",
    "engine.betrayl.reason.defendCookDead": "your Cook was already dead",
    "engine.betrayl.reason.defendCookNotResting": "your Cook was not resting",
    "engine.betrayl.report.selfFail": ({ reason, before, after }, { message }) =>
      `You sent Betrayal, but ${message(reason)}. Trust fell from ${before} to ${after}.`,
    "engine.betrayl.report.enemyFail": ({ reason, before, after }, { message }) =>
      `The enemy sent Betrayal, but ${message(reason)}. Your trust fell from ${before} to ${after}.`,
    "engine.betrayl.public.selfFail": ({ before, after }) =>
      `You sent Betrayal. The enemy trust fell from ${before} to ${after}.`,
    "engine.betrayl.public.enemyFail": ({ before, after }) =>
      `The enemy sent Betrayal. Your trust fell from ${before} to ${after}.`,
    "engine.kingReset.public.self":
      "Your King reached 5 stacks, killed the Cook, and reset exhaustion.",
    "engine.kingReset.public.enemy":
      "The enemy King reached 5 stacks, killed the Cook, and reset exhaustion.",
    "engine.kingMadness.public.self":
      "Your King reached the next 5th stack, went mad, and gave victory to the enemy.",
    "engine.kingMadness.public.enemy":
      "The enemy King reached the next 5th stack, went mad, and gave victory to your kingdom.",
    "engine.cookCollapse.report.self":
      "Your Cook reached the exhaustion limit and your King died.",
    "engine.cookCollapse.report.enemy":
      "The enemy Cook reached the exhaustion limit and their King died.",
    "engine.cookCollapse.public.self":
      "Your Cook reached 5 stacks and your King died.",
    "engine.cookCollapse.public.enemy":
      "The enemy Cook reached 5 stacks and their King died.",
    "engine.kingReset.report.self":
      "Your King reached the exhaustion limit, killed the Cook, and reset madness.",
    "engine.kingReset.report.enemy":
      "The enemy King reached the exhaustion limit, killed the Cook, and reset madness.",
    "engine.kingMadness.report.self":
      "Your King went mad at the next exhaustion limit and you lost the match.",
    "engine.kingMadness.report.enemy":
      "The enemy King went mad at the next exhaustion limit and gave victory to you.",
    "victory.capture": "Capture",
    "victory.assassination": "Assassination",
    "victory.madness": "Madness",
    "victory.none": "No victory",
  },
  ptBR: {
    "metric.trust": "Confianca",
    "ui.choice.rest": "Descanso",
    "ui.choice.attack": "Ataque",
    "ui.choice.ok": "OK",
    "ui.roundReport.lastRound": "Ultima rodada",
    "ui.roundReport.alerts": "Avisos",
    "ui.roundReport.enemyNoEffect":
      "O inimigo nao causou um efeito que precisasse ser relatado.",
    "ui.roundReport.selfNoEffect":
      "Sua jogada nao causou um efeito que precisasse ser relatado.",
    "ui.roundReport.enemyNotResolved":
      "O inimigo nao chegou a resolver a propria estrategia porque a partida acabou antes.",
    "ui.roundReport.selfNotResolved":
      "Sua estrategia nao chegou a resolver porque a partida acabou antes.",
    "ui.stage.openAttackView": "Abrir visualizacao de ataque",
    "ui.stage.openRestView": "Abrir visualizacao de descanso",
    "ui.stage.swapAttackRest": "Trocar entre ataque e descanso",
    "ui.stage.waiting": "Aguardando...",
    "ui.header.backToServers": "Voltar para servidores",
    "ui.header.nextTurn": "Proximo turno",
    "ui.overlay.winnerHint": "toque ou pressione qualquer tecla",
    "ui.overlay.winnerTitleAlt": "Vencedor",
    "ui.report.gameOver": "Fim da Partida",
    "ui.report.turns": "Turnos",
    "ui.report.winner": "Vencedor",
    "ui.report.type": "Tipo",
    "ui.report.playAgain": "Outra partida",
    "ui.report.viewBoard": "Ver tabuleiro",
    "ui.report.noWinner": "Ninguem",
    "ui.surrender.closeConfirm": "Fechar confirmacao de desistir",
    "ui.surrender.confirmTitle": "Desistir da partida?",
    "ui.surrender.confirmBody":
      "Voce vai sair desta sala e voltar para a lista de servidores.",
    "ui.surrender.cancel": "Cancelar",
    "ui.surrender.confirm": "Desistir",
    "ui.surrender.button": "Desistir",
    "ui.surrender.round": ({ round }) => `Round ${round}`,
    "ui.lobby.noPlayers": "Nenhum jogador na sala ainda.",
    "ui.lobby.roomTitle": ({ room }) => `Sala ${room}`,
    "ui.lobby.syncing": "Sincronizando com o servidor da sala.",
    "ui.lobby.waitingPlayers": "Esperando dois usuarios ativos na sala.",
    "ui.lobby.backToMenu": "Voltar ao menu local",
    "ui.blocked.noConfirmed": "Nenhum jogador confirmado nesta sala.",
    "ui.blocked.fullTitle": "Sala ocupada",
    "ui.blocked.notJoinedTitle": "Voce nao entrou nessa partida",
    "ui.blocked.fullCopy":
      "Essa sala ja tem dois jogadores. Use outra sala ou reinicie a partida existente.",
    "ui.blocked.notJoinedCopy":
      "Seu navegador sincronizou a sala, mas este usuario nao virou um dos dois jogadores ativos.",
    "ui.blocked.tip": "Dica: teste com uma sala nova e dois usuarios diferentes.",
    "ui.menu.userTitle": "Usuario.",
    "ui.menu.kicker": "jogo em sala vibinet",
    "ui.menu.userLabel": "Usuario",
    "ui.menu.userPlaceholder": "ex: Zorro",
    "ui.menu.viewServers": "Ver servidores",
    "ui.serverList.kicker": "lista fixa",
    "ui.serverList.title": "Servidores.",
    "ui.serverList.connect": "Conectar",
    "ui.serverList.back": "Voltar",
    "ui.notices.fillUserAndServer": "Preencha usuario e selecione um servidor.",
    "ui.notices.fillUser": "Preencha usuario.",
    "ui.notices.selectServer": "Selecione um servidor.",
    "ui.notices.matchReturnedToMenu": "A partida voltou ao menu compartilhado.",
    "ui.warning.king.limitCookFalls":
      "O King esta no limite. Ninguem descansa. O Cook cai agora.",
    "ui.warning.king.limitSelfFalls":
      "O King esta no limite. Ninguem descansa. Ele pode cair agora.",
    "ui.warning.king.limitCookNext":
      "O King esta no limite. Ninguem descansa. Se seguir assim, o Cook cai.",
    "ui.warning.king.limitSelfNext":
      "O King esta no limite. Ninguem descansa. Se seguir assim, ele cai.",
    "ui.warning.king.tired":
      "O King esta muito cansado. Se nao descansar, ninguem descansa.",
    "ui.warning.public.king.tired": ({ player }) =>
      `O King de ${player} esta muito cansado. Se nao descansar, ninguem descansa.`,
    "ui.warning.cook.limitKingFalls":
      "O Cook esta no limite. Betrayal ja passa. O King pode cair agora.",
    "ui.warning.cook.limitOnly": "O Cook esta no limite.",
    "ui.warning.cook.limitKingNext":
      "O Cook esta no limite. Betrayal passa. Se nao descansar, o King cai.",
    "ui.warning.cook.tiredCollapse":
      "O Cook esta muito cansado. Se nao descansar, pode entrar em colapso.",
    "ui.warning.cook.tiredBetrayl":
      "O Cook esta muito cansado. Se nao descansar, Betrayal passa.",
    "ui.warning.guard.exhausted": "O Guard esta esgotado. Invader ja passa direto.",
    "ui.warning.guard.tiredPasses":
      "O Guard esta muito cansado. Invader agora causa 3->4 de dano. Com 5, passa.",
    "ui.warning.guard.tiredDamage":
      "O Guard esta muito cansado. Invader agora causa 2->3 de dano.",
    "net.server.name": ({ number }) => `Sala ${number}`,
    "net.probe.unavailable.text": ({ server }) => `Servidor ${server} indisponivel.`,
    "net.probe.unavailable.detail":
      "A conexao inicial nem conseguiu abrir o cliente de rede.",
    "net.probe.online.text": ({ server }) => `Servidor ${server} online.`,
    "net.probe.online.detail":
      "A conexao com o servidor configurado respondeu ao sync inicial.",
    "net.probe.checking.text": ({ server }) => `Verificando ${server}...`,
    "net.probe.checking.detail":
      "A tela inicial ainda esta aguardando a primeira resposta de sync.",
    "net.probe.openWaiting.text": "Conexao aberta, aguardando sync inicial...",
    "net.probe.openWaiting.detail":
      "O websocket abriu, mas o servidor ainda nao respondeu ao on_sync.",
    "net.probe.reconnecting.text": ({ server }) => `Servidor ${server} reconectando.`,
    "net.probe.reconnecting.detail":
      "A conexao caiu ou nao respondeu. O cliente esta tentando reconectar.",
    "net.probe.offline.text": ({ server }) =>
      `Servidor ${server} offline ou sem resposta.`,
    "net.probe.offline.detail":
      "Se o botao de entrar nao fizer nada, o problema provavelmente esta no endpoint configurado.",
    "net.directory.unavailable": "indisponivel",
    "net.directory.noResponse": "sem resposta",
    "net.directory.checking": "verificando",
    "net.directory.syncing": "sincronizando",
    "net.directory.people.one": "1 pessoa",
    "net.directory.people.many": ({ count }) => `${count} pessoas`,
    "net.session.connecting": "Conectando ao servidor...",
    "net.session.targetRoom": ({ room }) => `Sala alvo: ${room}`,
    "net.session.server": ({ server }) => `Servidor: ${server}`,
    "net.session.waitingSync": "Ainda sem sync inicial.",
    "net.session.syncTimeoutDetail":
      "Se isso nao sair dessa tela, o endpoint configurado nao respondeu ao on_sync.",
    "engine.state.waitingPlayers": "Aguardando dois jogadores entrarem na sala.",
    "engine.state.matchStarted": ({ matchNumber }) =>
      `Partida ${matchNumber} iniciada. Preparando o turno 1.`,
    "engine.title.yourRest": "Seu descanso",
    "engine.title.spySent": "Voce enviou Spy",
    "engine.title.spyReport": "Relatorio do Spy",
    "engine.title.spyCaptured": "Spy capturado",
    "engine.title.kingFury": "Furia do King",
    "engine.title.kingMadness": "Loucura do King",
    "engine.title.cookCollapse": "Colapso do Cook",
    "engine.log.turnStarted": ({ turnNumber }) => `Turno ${turnNumber} iniciado.`,
    "engine.log.selectionOpened": "Selecao simultanea aberta.",
    "engine.log.resultsReady": "Resultados do turno prontos.",
    "engine.log.turnEndedWithVictory": "O turno terminou com uma vitoria.",
    "engine.log.exhaustionUpdated": "Contadores de exaustao atualizados.",
    "engine.log.userJoinedRoom": ({ user }) => `${user} entrou na sala.`,
    "engine.log.userLeftRoom": ({ user }) => `${user} saiu da sala.`,
    "engine.log.waitingAnotherPlayer": "Aguardando outro jogador para completar a sala.",
    "engine.log.roomEmpty": "A sala ficou vazia.",
    "engine.log.lockedCastle": ({ seat }) => `${seat} travou uma carta de castelo.`,
    "engine.log.lockedStrategy": ({ seat }) => `${seat} travou uma carta de estrategia.`,
    "engine.log.clearedCastle": ({ seat }) => `${seat} limpou a carta de castelo.`,
    "engine.log.clearedStrategy": ({ seat }) => `${seat} limpou a carta de estrategia.`,
    "engine.log.confirmedChoices": ({ seat }) => `${seat} confirmou suas escolhas.`,
    "engine.log.openedNextTurn": ({ user }) => `${user} abriu o proximo turno.`,
    "engine.log.closedMatchToMenu": ({ user }) =>
      `${user} encerrou a partida e voltou ao menu.`,
    "engine.log.restartedMatch": ({ user, matchNumber }) =>
      `${user} reiniciou a sala para a partida ${matchNumber}.`,
    "engine.log.assassinLost": ({ attacker, defender }) =>
      `${attacker} perdeu o Assassin. O King de ${defender} foi exposto.`,
    "engine.log.spyLostNobodyRested": ({ attacker }) =>
      `${attacker} perdeu o Spy porque ninguem descansou.`,
    "engine.log.spyFoundRest": ({ attacker, card }, { card: cardLabel }) =>
      `${attacker} usou Spy e encontrou ${cardLabel(card)} em descanso.`,
    "engine.log.invaderDroppedGuard": ({ attacker, defender }) =>
      `${attacker} derrubou o Guard de ${defender}.`,
    "engine.log.guardFellFromDamage": ({ defender }) =>
      `O Guard de ${defender} caiu por excesso de dano.`,
    "engine.log.tributeRaisedTrust": ({ attacker, defender }) =>
      `${attacker} enviou Tribute. A confianca de ${defender} subiu.`,
    "engine.log.betraylLoweredTrust": ({ attacker, defender }) =>
      `${attacker} derrubou a confianca de ${defender} com Betrayal.`,
    "engine.log.kingMadnessReset": ({ player }) =>
      `${player} deixou o King chegar a 5 stacks. O Cook morreu e a exaustao do King foi zerada.`,
    "engine.log.kingMadnessLoss": ({ player, enemy }) =>
      `${player} deixou o King enlouquecer no 5o stack. ${enemy} venceu imediatamente.`,
    "engine.rest.dummyText": "Voce escolheu Dummy. Ninguem descansou neste turno.",
    "engine.rest.withCard": ({ card }, { card: cardLabel }) =>
      `Voce descansou com ${cardLabel(card)}.`,
    "engine.report.default.selfVictoryBeforeResolve":
      "Sua estrategia nao chegou a resolver porque a partida acabou antes.",
    "engine.report.default.selfNoEffect":
      "Sua jogada nao causou um efeito que precisasse ser relatado.",
    "engine.report.default.enemyVictoryBeforeResolve":
      "O inimigo nao chegou a resolver a propria estrategia porque o turno terminou antes.",
    "engine.report.default.enemyNoEffect":
      "O inimigo nao causou um efeito que precisasse ser relatado.",
    "engine.assassin.public.selfKill": "Voce enviou Assassin e matou o King inimigo.",
    "engine.assassin.public.selfCaught": "Voce enviou Assassin, mas ele foi pego.",
    "engine.assassin.public.enemyKill":
      "O inimigo enviou Assassin e o seu King morreu enquanto descansava.",
    "engine.assassin.public.enemyCaught": "O inimigo enviou Assassin, mas ele foi pego.",
    "engine.assassin.report.selfKill":
      "Voce enviou Assassin e matou o King inimigo enquanto ele descansava.",
    "engine.assassin.report.selfCaught":
      "Voce enviou Assassin, mas ele foi executado antes de alcancar o King.",
    "engine.assassin.report.enemyKill":
      "O inimigo enviou Assassin e matou o seu King enquanto ele descansava.",
    "engine.assassin.report.enemyCaught":
      "O inimigo enviou Assassin, mas ele foi executado antes de alcancar o seu King.",
    "engine.winner.assassinatedKing": ({ attacker, defender }) =>
      `${attacker} assassinou o King de ${defender}.`,
    "engine.spy.sentText": "Seu agente tentou descobrir quem descansou do outro lado.",
    "engine.spy.report.selfCaught":
      "Voce enviou Spy, mas ele caiu no Dummy e foi preso.",
    "engine.spy.report.enemyCaught":
      "O inimigo enviou Spy, mas ele caiu no seu Dummy e foi preso.",
    "engine.spy.public.selfCaught":
      "Voce enviou um Spy, mas ele foi pego porque ninguem descansou.",
    "engine.spy.public.enemyCaught":
      "O inimigo enviou um Spy, mas ninguem descansou e ele foi pego.",
    "engine.spy.private.caught": "Seu Spy foi pego porque ninguem descansou neste turno.",
    "engine.spy.report.selfFound": ({ card }, { card: cardLabel }) =>
      `Voce enviou Spy e descobriu que o inimigo descansou com ${cardLabel(card)}.`,
    "engine.spy.report.enemyFound": ({ card }, { card: cardLabel }) =>
      `O inimigo enviou Spy e descobriu que voce descansou com ${cardLabel(card)}.`,
    "engine.spy.private.found": ({ card }, { card: cardLabel }) =>
      `Seu Spy descobriu que o inimigo descansou com ${cardLabel(card)}.`,
    "engine.invader.public.selfSleepingGuard":
      "Voce enviou Invader e o Guard do inimigo estava dormindo.",
    "engine.invader.public.enemySleepingGuard":
      "O inimigo enviou Invader e o seu Guard estava dormindo.",
    "engine.invader.public.selfExhaustedGuard":
      "Voce enviou Invader e o Guard do inimigo estava exausto demais para bloquear. O King foi capturado.",
    "engine.invader.public.enemyExhaustedGuard":
      "O inimigo enviou Invader e o seu Guard estava exausto demais para bloquear. O King foi capturado.",
    "engine.invader.public.selfGuardDefended": ({ before, after }) =>
      `Voce enviou Invader e o Guard do inimigo defendeu. A vida do Guard caiu de ${before} para ${after}.`,
    "engine.invader.public.enemyGuardDefended": ({ before, after }) =>
      `O inimigo enviou Invader e o seu Guard defendeu. A vida do Guard caiu de ${before} para ${after}.`,
    "engine.invader.public.selfUnavailableGuard":
      "Voce enviou Invader e o Guard do inimigo nao estava disponivel. O King foi capturado.",
    "engine.invader.public.enemyUnavailableGuard":
      "O inimigo enviou Invader e o seu Guard nao estava disponivel. O King foi capturado.",
    "engine.invader.report.selfKilledRestingGuard":
      "Voce enviou Invader e encontrou o Guard inimigo descansando. O Guard morreu.",
    "engine.invader.report.enemyKilledRestingGuard":
      "O inimigo enviou Invader e encontrou seu Guard descansando. O Guard morreu.",
    "engine.invader.report.selfDefended": (
      { before, after, deathSuffix },
      { message },
    ) =>
      `Voce enviou Invader. O Guard inimigo defendeu e foi de ${before} para ${after} de dano.${message(deathSuffix)}`,
    "engine.invader.report.enemyDefended": (
      { before, after, deathSuffix },
      { message },
    ) =>
      `O inimigo enviou Invader. Seu Guard defendeu e foi de ${before} para ${after} de dano.${message(deathSuffix)}`,
    "engine.invader.deathSuffix": " O Guard morreu com esse dano.",
    "engine.invader.report.selfCapturedExhausted":
      "Voce enviou Invader, mas o Guard inimigo estava exausto demais para bloquear. O King foi capturado.",
    "engine.invader.report.selfCapturedDead":
      "Voce enviou Invader enquanto o Guard inimigo ja estava morto. O King foi capturado.",
    "engine.invader.report.enemyCapturedExhausted":
      "O inimigo enviou Invader, mas o seu Guard estava exausto demais para bloquear. O King foi capturado.",
    "engine.invader.report.enemyCapturedDead":
      "O inimigo enviou Invader enquanto seu Guard ja estava morto. O King foi capturado.",
    "engine.winner.captureKing": ({ attacker, defender }) =>
      `${attacker} capturou o King de ${defender}.`,
    "engine.winner.cookCollapse": ({ player, enemy }) =>
      `${player} deixou o Cook chegar a 5 stacks. ${enemy} venceu imediatamente.`,
    "engine.tribute.report.selfGain": ({ before, after }) =>
      `Voce enviou Tribute e ganhou 1 confianca com o inimigo (${before} -> ${after}).`,
    "engine.tribute.report.selfMax": ({ value }) =>
      `Voce enviou Tribute e manteve a confianca do inimigo no maximo (${value}).`,
    "engine.tribute.report.enemyGain": ({ before, after }) =>
      `O inimigo enviou Tribute e ganhou 1 confianca com voce (${before} -> ${after}).`,
    "engine.tribute.report.enemyMax": ({ value }) =>
      `O inimigo enviou Tribute, mas a sua confianca nele ja estava no maximo (${value}).`,
    "engine.tribute.public.sent": ({ before, after }) =>
      `Voce enviou Tribute. A confianca do inimigo subiu de ${before} para ${after}.`,
    "engine.tribute.public.received": ({ before, after }) =>
      `Voce recebeu Tribute. Sua confianca subiu de ${before} para ${after}.`,
    "engine.betrayl.report.selfKill":
      "Voce enviou Betrayal e pegou o Cook inimigo descansando. O King foi envenenado.",
    "engine.betrayl.report.enemyKill":
      "O inimigo enviou Betrayal e pegou seu Cook descansando. O King foi envenenado.",
    "engine.betrayl.public.selfKill":
      "Voce enviou Betrayal enquanto o Cook inimigo dormia. O King foi envenenado.",
    "engine.betrayl.public.enemyKill":
      "O inimigo enviou Betrayal enquanto o seu Cook dormia. O King foi envenenado.",
    "engine.betrayl.report.selfExposedKill":
      "Voce enviou Betrayal e encontrou o King inimigo exposto. O King foi envenenado.",
    "engine.betrayl.report.enemyExposedKill":
      "O inimigo enviou Betrayal e encontrou seu King exposto. O King foi envenenado.",
    "engine.betrayl.public.selfExposedKill":
      "Voce enviou Betrayal enquanto o King inimigo estava exposto. O King foi envenenado.",
    "engine.betrayl.public.enemyExposedKill":
      "O inimigo enviou Betrayal enquanto o seu King estava exposto. O King foi envenenado.",
    "engine.winner.betrayl": ({ attacker, defender }) =>
      `${attacker} venceu com Betrayal sobre ${defender}.`,
    "engine.betrayl.reason.selfCookTooTired":
      "o seu Cook estava cansado demais para proteger o King",
    "engine.betrayl.reason.enemyCookDead": "o Cook inimigo ja estava morto",
    "engine.betrayl.reason.enemyCookNotResting":
      "o Cook inimigo nao estava descansando",
    "engine.betrayl.reason.defendCookTooTired":
      "o seu Cook estava cansado demais para proteger o King",
    "engine.betrayl.reason.defendCookDead": "seu Cook ja estava morto",
    "engine.betrayl.reason.defendCookNotResting": "seu Cook nao estava descansando",
    "engine.betrayl.report.selfFail": ({ reason, before, after }, { message }) =>
      `Voce enviou Betrayal, mas ${message(reason)}. A confianca caiu de ${before} para ${after}.`,
    "engine.betrayl.report.enemyFail": ({ reason, before, after }, { message }) =>
      `O inimigo enviou Betrayal, mas ${message(reason)}. Sua confianca caiu de ${before} para ${after}.`,
    "engine.betrayl.public.selfFail": ({ before, after }) =>
      `Voce enviou Betrayal. A confianca do inimigo caiu de ${before} para ${after}.`,
    "engine.betrayl.public.enemyFail": ({ before, after }) =>
      `O inimigo enviou Betrayal. Sua confianca caiu de ${before} para ${after}.`,
    "engine.kingReset.public.self":
      "Seu King chegou a 5 stacks, matou o proprio Cook e zerou a exaustao.",
    "engine.kingReset.public.enemy":
      "O King inimigo chegou a 5 stacks, matou o proprio Cook e zerou a exaustao.",
    "engine.kingMadness.public.self":
      "Seu King chegou ao proximo 5o stack, enlouqueceu e entregou a vitoria ao inimigo.",
    "engine.kingMadness.public.enemy":
      "O King inimigo chegou ao proximo 5o stack, enlouqueceu e entregou a vitoria ao seu reino.",
    "engine.cookCollapse.report.self":
      "Seu Cook chegou ao limite de exaustao e o seu King morreu.",
    "engine.cookCollapse.report.enemy":
      "O Cook inimigo chegou ao limite de exaustao e o King dele morreu.",
    "engine.cookCollapse.public.self":
      "Seu Cook chegou a 5 stacks e o seu King morreu.",
    "engine.cookCollapse.public.enemy":
      "O Cook inimigo chegou a 5 stacks e o King dele morreu.",
    "engine.kingReset.report.self":
      "Seu King chegou ao limite de exaustao, matou o proprio Cook e zerou a loucura.",
    "engine.kingReset.report.enemy":
      "O King inimigo chegou ao limite de exaustao, matou o proprio Cook e zerou a loucura.",
    "engine.kingMadness.report.self":
      "Seu King enlouqueceu ao chegar ao proximo limite de exaustao e voce perdeu a partida.",
    "engine.kingMadness.report.enemy":
      "O King inimigo enlouqueceu ao chegar ao proximo limite de exaustao e entregou a vitoria para voce.",
    "victory.capture": "Captura",
    "victory.assassination": "Assassinato",
    "victory.madness": "Loucura",
    "victory.none": "Sem vitoria",
  },
};

let currentLocale = DEFAULT_LOCALE;

function getEntry(locale, key) {
  return MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE]?.[key];
}

function getHelpers(locale) {
  return {
    card: (card) => getCardLabel(card, locale),
    phase: (phase) => getPhaseLabel(phase, locale),
    message: (value) => renderMessage(value, locale),
  };
}

export function setLocale(locale) {
  currentLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function getLocale() {
  return currentLocale;
}

export function msg(key, params = {}) {
  return { $msg: key, params };
}

export function isMessageDescriptor(value) {
  return Boolean(value && typeof value === "object" && "$msg" in value);
}

export function t(key, params = {}, locale = currentLocale) {
  const entry = getEntry(locale, key);
  if (typeof entry === "function") {
    return entry(params, getHelpers(locale));
  }
  if (typeof entry === "string") {
    return entry;
  }
  return key;
}

export function renderMessage(value, locale = currentLocale) {
  if (Array.isArray(value)) {
    return value
      .map((part) => renderMessage(part, locale))
      .filter(Boolean)
      .join(" ");
  }
  if (isMessageDescriptor(value)) {
    return t(value.$msg, value.params ?? {}, locale);
  }
  if (value && typeof value === "object" && "$card" in value) {
    return getCardLabel(value.$card, locale);
  }
  if (value && typeof value === "object" && "$phase" in value) {
    return getPhaseLabel(value.$phase, locale);
  }
  return String(value ?? "");
}

export function cardDescriptor(card) {
  return { $card: card };
}

export function phaseDescriptor(phase) {
  return { $phase: phase };
}

export { CARD_LABELS, DEFAULT_LOCALE, PHASE_LABELS, SUPPORTED_LOCALES };
