import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';

type Params = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { approval_status, caption, hashtags } = body;

    const updateFields: any = {};
    if (approval_status !== undefined) updateFields.approval_status = approval_status;
    if (caption !== undefined) updateFields.caption = caption;
    if (hashtags !== undefined) updateFields.hashtags = hashtags;

    const { data, error } = await supabase
      .from('content_logs')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error(`[API Content PATCH] Error on id ${req.nextUrl.pathname}:`, error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('content_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: 'Content deleted successfully.' });
  } catch (error: any) {
    console.error(`[API Content DELETE] Error on id ${req.nextUrl.pathname}:`, error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
