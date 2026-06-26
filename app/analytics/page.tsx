{activeSection === "games" && (
<section style={cardStyle}>

<h2 style={{marginBottom:25}}>Live Game Center</h2>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:15
}}
>

<input
style={inputStyle}
type="number"
value={quarter}
onChange={(e)=>setQuarter(Number(e.target.value))}
placeholder="Quarter"
/>

<input
style={inputStyle}
type="number"
value={down}
onChange={(e)=>setDown(Number(e.target.value))}
placeholder="Down"
/>

<input
style={inputStyle}
type="number"
value={distance}
onChange={(e)=>setDistance(Number(e.target.value))}
placeholder="Distance"
/>

<input
style={inputStyle}
type="number"
value={ballOn}
onChange={(e)=>setBallOn(Number(e.target.value))}
placeholder="Ball On"
/>

<select
style={inputStyle}
value={selectedFormation}
onChange={(e)=>setSelectedFormation(e.target.value)}
>
<option value="">Formation</option>

{formations.map(f=>(
<option
key={f.id}
value={f.id}
>
{f.name}
</option>
))}
</select>

<select
style={inputStyle}
value={selectedPlay}
onChange={(e)=>setSelectedPlay(e.target.value)}
>
<option value="">Play</option>

{plays.map(p=>(
<option
key={p.id}
value={p.id}
>
{p.name}
</option>
))}
</select>

<select
style={inputStyle}
value={selectedPlayType}
onChange={(e)=>setSelectedPlayType(e.target.value as "Run"|"Pass")}
>
<option>Run</option>
<option>Pass</option>
</select>

<input
style={inputStyle}
type="number"
value={yards}
onChange={(e)=>setYards(Number(e.target.value))}
placeholder="Yards"
/>

</div>

<button
style={primaryButtonStyle}
onClick={saveLivePlay}
>
SAVE PLAY
</button>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:20,
marginTop:35
}}
>

<HomeCard
title="Success Rate"
count={`${successRate}%`}
onClick={()=>{}}
/>

<HomeCard
title="Explosive"
count={`${explosivePlays.length}`}
onClick={()=>{}}
/>

<HomeCard
title="Negative"
count={`${negativePlays.length}`}
onClick={()=>{}}
/>

<HomeCard
title="Average"
count={`${averageYards}`}
onClick={()=>{}}
/>

</div>

<div style={listStyle}>

{livePlays.map((play,index)=>{

const formation=formations.find(f=>f.id===play.formation_id);

const playCall=plays.find(p=>p.id===play.play_id);

const color=
play.yards<=0
?"#dc2626"
:play.play_type==="Run"
?play.yards>=10
?"gold"
:play.yards>=4
?"#22c55e"
:"white"
:play.yards>=25
?"gold"
:play.yards>=12
?"#22c55e"
:"white";

return(

<div
key={play.id}
style={{
...listRowStyle,
borderLeft:`8px solid ${color}`
}}
>

<span>

#{index+1}

{" • "}

Q{play.quarter}

{" • "}

{formation?.name}

{" • "}

{playCall?.name}

{" • "}

{play.yards} yds

</span>

</div>

);

})}

</div>

</section>
)}
