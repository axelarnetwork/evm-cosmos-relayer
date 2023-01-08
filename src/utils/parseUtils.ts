
export const getPacketSequenceFromExecuteTx = (executeTx: any) => {
  const rawLog = JSON.parse(executeTx.rawLog || '{}')
  const events = rawLog[0].events;
  const sendPacketEvent = events.find((event: { type: string; }) => event.type === "send_packet")
  const seq =  sendPacketEvent.attributes.find((attr: { key: string; }) => attr.key === "packet_sequence").value
  return parseInt(seq)
}
