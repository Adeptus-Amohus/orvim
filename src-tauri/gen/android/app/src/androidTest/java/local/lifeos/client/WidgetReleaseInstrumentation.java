package local.lifeos.client;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.io.*;

/** No test/library or app-code dependencies: exercises the distributed minified APK. */
public class WidgetReleaseInstrumentation extends Instrumentation {
  private View inside(View root,String name){
    if(root.getId()!=View.NO_ID){try{if(root.getResources().getResourceEntryName(root.getId()).equals(name))return root;}catch(Exception ignored){}}
    if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++){View found=inside(((ViewGroup)root).getChildAt(i),name);if(found!=null)return found;}
    return null;
  }
  private String text(View root){String result=root instanceof TextView?((TextView)root).getText().toString()+"\n":"";
    if(root instanceof ViewGroup)for(int i=0;i<((ViewGroup)root).getChildCount();i++)result+=text(((ViewGroup)root).getChildAt(i));return result;}
  @Override public void onCreate(Bundle args){super.onCreate(args);start();}
  @Override public void onStart(){
    Bundle result=new Bundle();Activity activity=null;AppWidgetHost host=null;
    try{
      getUiAutomation().adoptShellPermissionIdentity("android.permission.START_ACTIVITIES_FROM_BACKGROUND");
      try{activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"local.lifeos.client.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
      finally{getUiAutomation().dropShellPermissionIdentity();}
      Thread.sleep(1500);
      Context context=getTargetContext();AppWidgetManager manager=AppWidgetManager.getInstance(context);
      host=new AppWidgetHost(context,38124);host.startListening();int passed=0;StringBuilder errors=new StringBuilder();
      for(boolean compat:new boolean[]{false,true})for(String suffix:new String[]{"Day","Thought","Food"}){
        int id=host.allocateAppWidgetId();ComponentName component=new ComponentName(context.getPackageName(),"local.lifeos.client.Orvim"+suffix+"Widget");
        if(!manager.bindAppWidgetIdIfAllowed(id,component))throw new AssertionError("Cannot bind "+component);
        final Activity owner=activity;final AppWidgetHost widgetHost=host;
        final AppWidgetHostView[] view=new AppWidgetHostView[1];
        final int width=suffix.equals("Day")?300:suffix.equals("Food")?150:180;
        final int height=suffix.equals("Day")?400:suffix.equals("Food")?150:64;
        runOnMainSync(()->{
          Context hostContext=compat?owner:new ContextThemeWrapper(context,android.R.style.Theme_DeviceDefault_DayNight);
          view[0]=widgetHost.createView(hostContext,id,manager.getAppWidgetInfo(id));
          view[0].updateAppWidgetSize(null,width,height,width,height);owner.setContentView(view[0]);
          float scale=context.getResources().getDisplayMetrics().density;owner.getWindow().setLayout((int)(width*scale),(int)(height*scale));
        });
        context.sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(component).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,new int[]{id}));
        Thread.sleep(4000);
        runOnMainSync(()->{
          try{Bitmap bitmap=Bitmap.createBitmap(Math.max(1,view[0].getWidth()),Math.max(1,view[0].getHeight()),Bitmap.Config.ARGB_8888);view[0].draw(new Canvas(bitmap));
            File folder=context.getExternalFilesDir("widget-release-qa");folder.mkdirs();try(FileOutputStream stream=new FileOutputStream(new File(folder,suffix+"-"+compat+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,stream);}}
          catch(Exception e){throw new RuntimeException(e);}
        });
        if(inside(view[0],"widget_title")==null)errors.append(suffix+" compat="+compat+": "+text(view[0])+"\n");
        if(suffix.equals("Day")){View list=inside(view[0],"widget_timeline_list");if(!(list instanceof ListView)||((ListView)list).getCount()!=24)errors.append("Hours not loaded compat="+compat+": "+text(view[0])+"\n");}
        host.deleteAppWidgetId(id);passed++;
      }
      if(errors.length()>0)throw new AssertionError(errors.toString());
      result.putString("stream","OK: "+passed+" packaged widget hosts\n");finish(Activity.RESULT_OK,result);
    }catch(Throwable failure){StringWriter trace=new StringWriter();failure.printStackTrace(new PrintWriter(trace));result.putString("stream",trace.toString());finish(Activity.RESULT_CANCELED,result);}
    finally{if(host!=null){host.stopListening();host.deleteHost();}if(activity!=null){final Activity owner=activity;runOnMainSync(owner::finish);}}
  }
}
