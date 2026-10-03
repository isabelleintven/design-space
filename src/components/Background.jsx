import spaceCow from '../assets/space-cow.jpg'

// Achtergrond: kalf in een ruimtewei. Het kalf staat midden-onder, de sterrenhemel bovenin
// laat ruimte voor de gecentreerde titel.
export default function Background() {
  return (
    <>
      <div className="bg" style={{ backgroundImage: `url(${spaceCow})` }} aria-hidden="true" />
      <div className="bg-shade" />
    </>
  )
}
