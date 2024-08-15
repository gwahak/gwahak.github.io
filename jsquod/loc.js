texts=new Object()
texts[0]="tie: there's no more quads!"
texts[1]="you lose!"
texts[2]="you win!"
texts[3]="red won"
texts[4]="blue won"

function nquasars_text(n)
{
	return n?n+" quasar"+(n==1?"":"s")+" left":"no quasars"
}
